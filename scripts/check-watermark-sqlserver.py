"""Opt-in synthetic SQL Server qualification of an installed generated control asset.

Uses the official pinned Developer image, loopback-only exposure and a disposable
control database. No Azure calls. Self-signed local TLS is trusted only by this
harness; Azure connectivity, identities and native Copy execution remain separate.
Requires the connector's existing mssql_python environment.
"""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import threading
import time
import uuid

IMAGE = 'mcr.microsoft.com/mssql/server@sha256:4402d880dd4c34bfa7d8705e56a86cd6c88da80a1f6bbbe741f999e76264a090'
parser = argparse.ArgumentParser()
parser.add_argument('--sql-file', type=Path, required=True)
parser.add_argument('--proof', type=Path, required=True)
args = parser.parse_args()
if os.environ.get('INGESTRON_TEST_CONTAINERS') != '1':
    raise SystemExit('Set INGESTRON_TEST_CONTAINERS=1 for synthetic local SQL Server qualification')
import mssql_python
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

def connect(database='control'):
    return mssql_python.connect(
        f'Server=127.0.0.1,{port};Database={database};UID=sa;PWD={password};Encrypt=yes;TrustServerCertificate=yes', timeout=5)

def execute(sql, values=(), database='control'):
    with connect(database) as db:
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

def with_error_number(sql):
    # This driver omits native error numbers; preserve them in the synthetic SQL error message.
    return "BEGIN TRY " + sql + "; END TRY BEGIN CATCH DECLARE @Message nvarchar(2048)=CONCAT(ERROR_NUMBER(), ': ', ERROR_MESSAGE()); THROW 52000, @Message, 1; END CATCH;"

def reject(sql, values, expected=None):
    try:
        execute(with_error_number(sql), values)
    except Exception as error:
        if expected is not None:
            assert str(expected) in str(error), str(error)
        return
    raise AssertionError('An invalid or stale transition unexpectedly succeeded')

D = 'a' * 64
KEY = 'acceptance.dev.orders'
BASE = 9007199254740992
RUN = str(uuid.uuid4())
READ = 'EXEC dbo.IngestronReadWatermarkV1 ?, ?, ?'
VALIDATE = 'EXEC dbo.IngestronValidateBatchV1 ?, ?, ?, ?, ?'
COMMIT = 'EXEC dbo.IngestronCommitWatermarkV1 ?, ?, ?, ?, ?, ?, ?'

def commit_values(key=KEY, run=RUN, low=BASE, high=BASE + 2, rows=2, path='landing/orders/' + RUN, digest=D):
    return (key, run, digest, str(low), str(high), rows, path)

def state(key=KEY):
    return execute('SELECT CONVERT(varchar(20), Watermark) FROM dbo.IngestronWatermarkV1 WHERE Dataset=?', (key,))[0][0]

before = set(docker('ps', '-q').splitlines())
try:
    container = docker('run', '--platform', 'linux/amd64', '-d', '--rm', '--memory', '2g', '--cpus', '2',
                       '-p', '127.0.0.1::1433', '-e', 'ACCEPT_EULA=Y', '-e', 'MSSQL_PID=Developer',
                       '-e', 'MSSQL_SA_PASSWORD=' + password, IMAGE)
    port = int(docker('port', container, '1433').split(':')[-1])
    deadline = time.monotonic() + 240
    while True:
        try:
            execute("IF DB_ID('control') IS NULL CREATE DATABASE control", database='master')
            break
        except Exception:
            if time.monotonic() >= deadline:
                raise RuntimeError('Synthetic SQL Server startup timed out')
            time.sleep(2)
    text = args.sql_file.read_text()
    for batch in re.split(r'^GO\s*$', text, flags=re.MULTILINE):
        if batch.strip():
            execute(batch)
    checks.append('generated control DDL and all three procedures compile on SQL Server 2022')
    assert execute(READ, (KEY, D, str(BASE)))[0][0] == str(BASE)
    assert execute(READ, (KEY, D, '0'))[0][0] == str(BASE)
    assert execute(READ, (KEY.upper(), D, '0'))[0][0] == '0'
    checks.append('int64 beyond JavaScript precision remains exact; read does not reset; binary dataset identities remain separate')
    reject(READ, (KEY, 'b' * 64, '0'), 51003)
    for value in ['00', '-1', '1 ', ' 1', '9223372036854775808', "1'; DROP TABLE x--", None]:
        reject(READ, ('invalid', D, value), 51000)
    for key, digest in [('x' * 401, D), ('bad identity', D), ('other', D + 'a'), ('other', 'A' * 64)]:
        reject(READ, (key, digest, '0'))
    checks.append('changed plans and malformed, oversized or truncated identities and cursors fail before state creation')
    assert execute(VALIDATE, (KEY, D, str(BASE), str(BASE + 2), RUN))[0] == (str(BASE), str(BASE + 2), RUN)
    for low, high, run in [('0', str(BASE + 2), RUN), ('0;DROP', '1', RUN), (str(BASE), str(BASE), RUN),
                           (str(BASE), str(BASE + 2), RUN + 'suffix'), (str(BASE), str(BASE + 2), '../outside')]:
        reject(VALIDATE, (KEY, D, low, high, run))
    assert state() == str(BASE)
    checks.append('worker validates checkpoint and canonical cursor/run parameters without changing state')
    execute(COMMIT, commit_values())
    assert state() == str(BASE + 2)
    assert execute('SELECT CONVERT(varchar(20),LowerWatermark),CONVERT(varchar(20),UpperWatermark),[RowCount] FROM dbo.IngestronDeliveryV1 WHERE Dataset=?', (KEY,))[0] == (str(BASE), str(BASE + 2), 2)
    execute(COMMIT, commit_values())
    assert execute('SELECT COUNT(*) FROM dbo.IngestronDeliveryV1 WHERE Dataset=?', (KEY,))[0][0] == 1
    reject(COMMIT, commit_values(path='landing/changed'), 51012)
    reject(COMMIT, commit_values(path='landing/orders/' + RUN + ' '), 51012)
    reject(COMMIT, commit_values(run=str(uuid.uuid4())), 51013)
    checks.append('one atomic publication; exact original-run replay is idempotent; changed replay and competing stale commit are rejected')
    failure_key = 'acceptance.dev.failure'
    execute(READ, (failure_key, D, '0'))
    execute("CREATE TRIGGER dbo.FailDelivery ON dbo.IngestronDeliveryV1 AFTER INSERT AS BEGIN THROW 51999, 'Synthetic insert failure', 1; END")
    failed = commit_values(key=failure_key, run=str(uuid.uuid4()), low=0, high=2)
    reject(COMMIT, failed, 51999)
    assert state(failure_key) == '0'
    assert execute('SELECT COUNT(*) FROM dbo.IngestronDeliveryV1 WHERE Dataset=?', (failure_key,))[0][0] == 0
    execute('DROP TRIGGER dbo.FailDelivery')
    execute(COMMIT, failed)
    assert state(failure_key) == '2'
    checks.append('real failure after checkpoint update rolls back both state and journal; retry succeeds')
    race_key = 'acceptance.dev.race'
    execute(READ, (race_key, D, '0'))
    barrier = threading.Barrier(2)
    def race():
        values = commit_values(key=race_key, run=str(uuid.uuid4()), low=0, high=2)
        barrier.wait()
        try:
            execute(with_error_number(COMMIT), values)
            return 'committed'
        except Exception as error:
            assert '51013' in str(error), str(error)
            return 'stale'
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        result = list(pool.map(lambda _: race(), range(2)))
    assert sorted(result) == ['committed', 'stale']
    assert state(race_key) == '2'
    assert execute('SELECT COUNT(*) FROM dbo.IngestronDeliveryV1 WHERE Dataset=?', (race_key,))[0][0] == 1
    checks.append('concurrent compare-and-swap writers yield exactly one publication')
    reject(COMMIT, commit_values(key=race_key, run=str(uuid.uuid4()), low=2, high=3, rows=None), 51008)
    reject(COMMIT, commit_values(key=race_key, run=str(uuid.uuid4()), low=2, high=3, rows=1000001), 51008)
    reject(COMMIT, commit_values(key=race_key, run=str(uuid.uuid4()), low=2, high=3, path='x' * 1001), 51009)
    assert state(race_key) == '2'
    checks.append('invalid count and oversized evidence cannot advance a checkpoint')
    execute("CREATE USER pipeline WITHOUT LOGIN; GRANT EXECUTE ON dbo.IngestronReadWatermarkV1 TO pipeline; GRANT EXECUTE ON dbo.IngestronValidateBatchV1 TO pipeline; GRANT EXECUTE ON dbo.IngestronCommitWatermarkV1 TO pipeline;")
    assert execute("EXECUTE AS USER='pipeline'; EXEC dbo.IngestronReadWatermarkV1 'permissions.dev.orders', ?, '0'; REVERT;", (D,))[0][0] == '0'
    reject("EXECUTE AS USER='pipeline'; UPDATE dbo.IngestronWatermarkV1 SET Watermark=99; REVERT;", (), 229)
    checks.append('execute-only control principal can use ownership-chained procedures and cannot directly update checkpoint tables')
    # Reapplication must preserve prior state and committed journals.
    for batch in re.split(r'^GO\s*$', text, flags=re.MULTILINE):
        if batch.strip():
            execute(batch)
    assert state() == str(BASE + 2)
    checks.append('control asset reapplication preserves existing state and publication history')
    version = execute('SELECT CAST(SERVERPROPERTY(\'ProductVersion\') AS varchar(40))')[0][0]
finally:
    if container:
        docker('rm', '-f', container)
    after = set(docker('ps', '-q').splitlines())
    assert before.issubset(after), 'An unrelated existing container disappeared during acceptance'
args.proof.parent.mkdir(parents=True, exist_ok=True)
args.proof.write_text(json.dumps({'apiVersion': 'ingestron.native-watermark-sql-acceptance/v1', 'result': 'passed',
    'image': IMAGE, 'serverVersion': version, 'controlAsset': str(args.sql_file.resolve()),
    'controlSha256': hashlib.sha256(text.encode()).hexdigest(), 'checks': checks,
    'containerRemoved': True, 'preExistingContainersPreserved': True,
    'limits': ['Local self-signed TLS only; Azure identities and connectivity remain unqualified',
               'This qualifies SQL control transactions, not ADF Copy or cloud pipeline execution']}, indent=2) + '\n')
print(json.dumps({'result': 'passed', 'checks': len(checks), 'proof': str(args.proof.resolve())}))
