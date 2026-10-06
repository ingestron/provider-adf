"""Execute the exact installed native manifest Lookup query on synthetic SQL Server.

Requires opt-in. No source/customer data, ADF API, Copy or target execution.
The temporary container is always removed; pre-existing containers are preserved.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import uuid

IMAGE = 'mcr.microsoft.com/mssql/server@sha256:4402d880dd4c34bfa7d8705e56a86cd6c88da80a1f6bbbe741f999e76264a090'
parser = argparse.ArgumentParser()
parser.add_argument('--fixture', type=Path, required=True)
parser.add_argument('--proof', type=Path, required=True)
args = parser.parse_args()
if os.environ.get('INGESTRON_TEST_CONTAINERS') != '1':
    raise SystemExit('Set INGESTRON_TEST_CONTAINERS=1 for isolated synthetic engine checks')
import mssql_python
seed = json.loads(args.fixture.read_text())
assert seed['result'] == 'passed' and seed['coreVersion'] == '0.12.21'
record = next(row for row in seed['records'] if row.get('kind') == 'monthly')
entry = next(row for row in record['files'] if row['name'].endswith('pipelines/retail_source_schedule_dispatch.json'))
asset = Path(seed['root'])/'build/monthly/sdk'/entry['name']
assert hashlib.sha256(asset.read_bytes()).hexdigest() == entry['sha256']
pipeline = json.loads(asset.read_text())
queries = []
def walk(value):
    if isinstance(value, dict):
        if isinstance(value.get('sqlReaderQuery'), str) and value['sqlReaderQuery'].startswith('WITH [manifest]'):
            queries.append(value['sqlReaderQuery'])
        for child in value.values():
            walk(child)
    elif isinstance(value, list):
        for child in value:
            walk(child)
walk(pipeline)
assert len(queries) == 1
query = queries[0]
assert "([tableId]+N'#') COLLATE Latin1_General_100_BIN2 IN" in query
binary = ['docker']
if os.environ.get('INGESTRON_DOCKER_CONTEXT'):
    binary.extend(['--context', os.environ['INGESTRON_DOCKER_CONTEXT']])
password = 'Synthetic-' + uuid.uuid4().hex + '-A1!'
reader_password = 'Synthetic-' + uuid.uuid4().hex + '-A1!'
checks = []
container = None
port = None
result = 'failed'
def docker(*parts):
    return subprocess.run([*binary, *parts], check=True, capture_output=True, text=True).stdout.strip()
def execute(sql, values=(), database='schedules', reader=False):
    user, secret = ('manifest_reader', reader_password) if reader else ('sa', password)
    with mssql_python.connect(f'Server=127.0.0.1,{port};Database={database};UID={user};PWD={secret};Encrypt=yes;TrustServerCertificate=yes', timeout=5) as db:
        db.autocommit = True
        cursor = db.cursor()
        cursor.execute(sql, values)
        rows = []
        while True:
            if cursor.description:
                rows.extend(tuple(row) for row in cursor.fetchall())
            if not cursor.nextset():
                break
        return rows
valid = [('source/customers', 2), ('source/orders', 3), ('source/products', 5), ('manual/customers', 999)]
def populate(rows):
    execute('DELETE FROM governance.manifest_rows')
    for row in rows:
        execute('INSERT governance.manifest_rows VALUES (?,?)', row)
def lookup(settings='SET LANGUAGE us_english; SET DATEFORMAT ymd;'):
    return execute(settings + query, reader=True)
before = set(docker('ps', '-q').splitlines())
try:
    container = docker('run', '--platform', 'linux/amd64', '-d', '--rm', '--memory', '2g', '--cpus', '2', '-p', '127.0.0.1::1433', '-e', 'ACCEPT_EULA=Y', '-e', 'MSSQL_PID=Developer', '-e', 'MSSQL_SA_PASSWORD=' + password, IMAGE)
    port = int(docker('port', container, '1433').split(':')[-1])
    deadline = time.monotonic() + 240
    while True:
        try:
            execute("IF DB_ID('schedules') IS NULL CREATE DATABASE schedules", database='master')
            break
        except Exception:
            if time.monotonic() >= deadline:
                raise RuntimeError('Synthetic SQL Server startup timed out')
            time.sleep(2)
    version = execute("SELECT CAST(SERVERPROPERTY('ProductVersion') AS varchar(30))")[0][0]
    execute('CREATE SCHEMA governance')
    execute('CREATE TABLE governance.manifest_rows (tableId nvarchar(100) NULL, expectedRowCount decimal(38,6) NULL)')
    execute('CREATE VIEW governance.frozen_manifest AS SELECT tableId,expectedRowCount FROM governance.manifest_rows')
    execute("CREATE LOGIN manifest_reader WITH PASSWORD='" + reader_password + "', CHECK_POLICY=OFF", database='master')
    execute('CREATE USER manifest_reader FOR LOGIN manifest_reader; GRANT SELECT ON OBJECT::governance.frozen_manifest TO manifest_reader')
    populate(valid)
    expected = valid[:3]
    for settings in ['SET LANGUAGE us_english; SET DATEFORMAT ymd;', 'SET LANGUAGE French; SET DATEFORMAT dmy;', 'SET LANGUAGE German; SET DATEFORMAT mdy;']:
        assert lookup(settings) == expected
    checks.append('Exact installed Lookup query returns only its three compiled table IDs in deterministic order under three native session settings and a read-only view credential')
    populate([('source/customers', 7), ('source/orders', 2147483647), ('source/products', 6)])
    assert lookup() == [('source/customers', 7), ('source/orders', 2147483647), ('source/products', 6)]
    checks.append('Fresh source-owned counts and native Int maximum are read at invocation; no fixed generated count is reused')
    for label, rows in [
        ('missing', valid[:2]),
        ('duplicate', valid[:3] + [valid[0]]),
        ('case-altered', [('Source/customers', 2), *valid[1:3]]),
        ('trailing-space', [('source/customers ', 2), *valid[1:3]]),
        ('leading-space', [(' source/customers', 2), *valid[1:3]]),
        ('null-count', [('source/customers', None), *valid[1:3]]),
        ('negative-count', [('source/customers', -1), *valid[1:3]]),
        ('unreviewed-empty', [('source/customers', 0), *valid[1:3]]),
        ('fractional-count', [('source/customers', '2.5'), *valid[1:3]]),
        ('native-overflow', [('source/customers', 2147483648), *valid[1:3]]),
    ]:
        populate(rows)
        assert lookup() == [], label
        checks.append(label + ' cohort cannot produce any dispatchable inputs')
    try:
        execute("INSERT governance.manifest_rows VALUES (N'source/customers',1)", reader=True)
        raise AssertionError('Read-only source credential could write')
    except mssql_python.Error:
        pass
    execute('REVOKE SELECT ON OBJECT::governance.frozen_manifest FROM manifest_reader')
    try:
        lookup()
        raise AssertionError('Revoked source permission produced inputs')
    except mssql_python.Error:
        pass
    checks.append('Native read-only credential cannot modify manifest data; revoked source permissions fail the query before any inputs can dispatch')
    result = 'passed'
finally:
    if container:
        docker('rm', '-f', container)
    after = set(docker('ps', '-q').splitlines())
    args.proof.write_text(json.dumps({'apiVersion':'ingestron.adf-schedule-manifest-sqlserver/v1','result':result,'fixture':str(args.fixture),'asset':str(asset),'assetSha256':entry['sha256'],'querySha256':hashlib.sha256(query.encode()).hexdigest(),'provider':seed['provider'],'archives':seed['archives'],'image':IMAGE,'serverVersion':locals().get('version'),'checks':checks,'containerRemoved':container not in after,'preExistingContainersPreserved':before <= after,'limits':['Actual SQL Server Lookup query and independent synthetic source counts only','No publication-input query, Azure identity, ADF Lookup/Copy/dispatch/activity execution or clock qualification','Frozen manifest/source extract consistency and recurring source-owner protocol remain separate responsibilities']},indent=2)+'\n')
print(json.dumps({'result':result,'checks':len(checks)}))
