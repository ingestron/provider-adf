"""Execute installed generated quality counts on a disposable synthetic SQL Server.

Opt-in only. Uses the existing test driver and pinned official Developer image,
loopback exposure and a fresh database. It never invokes Copy or an ADF API.
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
    raise SystemExit('Set INGESTRON_TEST_CONTAINERS=1 for synthetic local SQL Server checks')
import mssql_python
seed = json.loads(args.fixture.read_text())
assert seed['result'] == 'passed'
record = next(item for item in seed['queries'] if item['kind'] == 'azure-sql')
asset = Path(record['path'])
assert hashlib.sha256(asset.read_bytes()).hexdigest() == record['sha256']
query = json.loads(asset.read_text())
assert query['providerCommit'] == seed['providerCommit']
assert query['query'] == query['pipeline']['properties']['activities'][0]['typeProperties']['source']['sqlReaderQuery']
checks = []
container = None
password = 'Synthetic-' + uuid.uuid4().hex + '-A1!'
port = None
binary = ['docker']
if os.environ.get('INGESTRON_DOCKER_CONFIG'):
    binary.extend(['--config', os.environ['INGESTRON_DOCKER_CONFIG']])
if os.environ.get('INGESTRON_DOCKER_HOST'):
    binary.extend(['--host', os.environ['INGESTRON_DOCKER_HOST']])

def docker(*parts):
    return subprocess.run([*binary, *parts], check=True, capture_output=True, text=True).stdout.strip()

def execute(sql, values=(), database='quality'):
    with mssql_python.connect(f'Server=127.0.0.1,{port};Database={database};UID=sa;PWD={password};Encrypt=yes;TrustServerCertificate=yes', timeout=5) as db:
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

def counts(setting='SET LANGUAGE us_english; SET DATEFORMAT ymd;'):
    rows = execute(setting + query['query'])
    assert len(rows) == 1
    assert len(rows[0]) == len(query['rules'])
    return {rule['id']: int(rows[0][i]) for i, rule in enumerate(query['rules'])}

before = set(docker('ps', '-q').splitlines())
result = 'failed'
try:
    container = docker('run', '--platform', 'linux/amd64', '-d', '--rm', '--memory', '2g', '--cpus', '2', '-p', '127.0.0.1::1433', '-e', 'ACCEPT_EULA=Y', '-e', 'MSSQL_PID=Developer', '-e', 'MSSQL_SA_PASSWORD=' + password, IMAGE)
    port = int(docker('port', container, '1433').split(':')[-1])
    deadline = time.monotonic() + 240
    while True:
        try:
            execute("IF DB_ID('quality') IS NULL CREATE DATABASE quality", database='master')
            break
        except Exception:
            if time.monotonic() >= deadline:
                raise RuntimeError('Synthetic SQL Server startup timed out')
            time.sleep(2)
    version = execute("SELECT CAST(SERVERPROPERTY('ProductVersion') AS varchar(30))")[0][0]
    execute('CREATE TABLE dbo.orders (source_id BIGINT NOT NULL, day DATE NULL, event DATETIME2(6) NULL)')
    execute("INSERT dbo.orders VALUES (1,CONVERT(date,'20240229',112),CONVERT(datetime2(6),'2024-02-29T01:02:03.123456',126)), (2,CONVERT(date,'20000229',112),CONVERT(datetime2(6),'2000-02-29T00:00:00',126)), (3,NULL,NULL)")
    expected = {'day-valid': 0, 'clock-valid': 0, 'clock-missing': 1, 'orders.id.key-not-null': 0, 'orders.key-unique': 0}
    for settings in ['SET LANGUAGE us_english; SET DATEFORMAT ymd;', 'SET LANGUAGE French; SET DATEFORMAT dmy;', 'SET LANGUAGE German; SET DATEFORMAT mdy;']:
        assert counts(settings) == expected
    checks.append('Exact installed generated count query accepts leap dates, six-digit mapped clocks and nulls under three native language/date-format sessions')
    execute("UPDATE dbo.orders SET day=CONVERT(date,'20240301',112), event=CONVERT(datetime2(6),'2024-02-29T01:02:03.123457',126) WHERE source_id=1")
    changed = counts()
    assert changed['day-valid'] == 1 and changed['clock-valid'] == 1
    checks.append('Changing the date or one microsecond is counted as invalid by the installed required native rules')
    execute("UPDATE dbo.orders SET event=CONVERT(datetime2(6),'2000-01-01T00:00:00',126) WHERE source_id=2")
    assert counts()['clock-missing'] == 2
    checks.append('Typed listed missing values and nullable clocks use the same native equality without string or timezone guessing')
    execute('DELETE FROM dbo.orders')
    assert all(value == 0 for value in counts().values())
    checks.append('Empty synthetic table returns one all-zero aggregate row; this does not qualify snapshot empty/copy policy')
    result = 'passed'
finally:
    if container:
        docker('rm', '-f', container)
    after = set(docker('ps', '-q').splitlines())
    args.proof.write_text(json.dumps({'apiVersion': 'ingestron.adf-temporal-sqlserver-acceptance/v1', 'result': result, 'image': IMAGE, 'serverVersion': locals().get('version'), 'fixture': str(args.fixture), 'queryAsset': str(asset), 'querySha256': record['sha256'], 'providerCommit': seed['providerCommit'], 'providerModuleSha256': seed['providerModuleSha256'], 'checks': checks, 'containerRemoved': container not in after, 'preExistingContainersPreserved': before <= after, 'limits': ['Disposable synthetic DATE/plain DATETIME2(6) native query counts only', 'Local self-signed TLS; no Azure identity, ADF Copy/pipeline/deployment or source-native timezone qualification']}, indent=2) + '\n')
print(json.dumps({'result': result, 'checks': len(checks), 'proof': str(args.proof)}))
