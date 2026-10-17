"""Execute installed generated quality counts on a disposable synthetic PostgreSQL.

Opt-in only. Uses the existing test driver and pinned official PostgreSQL image,
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

IMAGE = 'postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24'
parser = argparse.ArgumentParser()
parser.add_argument('--fixture', type=Path, required=True)
parser.add_argument('--proof', type=Path, required=True)
args = parser.parse_args()
if os.environ.get('INGESTRON_TEST_CONTAINERS') != '1':
    raise SystemExit('Set INGESTRON_TEST_CONTAINERS=1 for synthetic local PostgreSQL checks')
import pg8000.dbapi
seed = json.loads(args.fixture.read_text())
assert seed['result'] == 'passed'
record = next(item for item in seed['queries'] if item['kind'] == 'postgresql')
asset = Path(record['path'])
assert hashlib.sha256(asset.read_bytes()).hexdigest() == record['sha256']
query = json.loads(asset.read_text())
assert query['providerCommit'] == seed['providerCommit']
assert query['query'] == query['pipeline']['properties']['activities'][0]['typeProperties']['source']['query']
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

def execute(sql, values=(), database='postgres'):
    db = pg8000.dbapi.connect(host='127.0.0.1', port=port, database=database, user='postgres', password=password, timeout=5)
    try:
        db.autocommit = True
        cursor = db.cursor()
        cursor.execute(sql, values)
        return [tuple(row) for row in cursor.fetchall()] if cursor.description else []
    finally:
        db.close()

def counts(setting="SET TIME ZONE 'UTC'; SET DateStyle TO 'ISO, YMD';"):
    rows = execute(setting + query['query'])
    assert len(rows) == 1
    assert len(rows[0]) == len(query['rules'])
    return {rule['id']: int(rows[0][i]) for i, rule in enumerate(query['rules'])}

before = set(docker('ps', '-q').splitlines())
result = 'failed'
try:
    container = docker('run', '-d', '--rm', '--memory', '512m', '--cpus', '2', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=' + password, IMAGE)
    port = int(docker('port', container, '5432').split(':')[-1])
    deadline = time.monotonic() + 240
    while True:
        try:
            execute('SELECT 1')
            break
        except Exception:
            if time.monotonic() >= deadline:
                raise RuntimeError('Synthetic PostgreSQL startup timed out')
            time.sleep(2)
    version = execute('SHOW server_version')[0][0]
    execute('CREATE TABLE public.orders (source_id BIGINT NOT NULL, day DATE NULL, event TIMESTAMP(6) WITHOUT TIME ZONE NULL)')
    execute("INSERT INTO public.orders VALUES (1,DATE '2024-02-29',TIMESTAMP '2024-02-29 01:02:03.123456'), (2,DATE '2000-02-29',TIMESTAMP '2000-02-29 00:00:00'), (3,NULL,NULL)")
    expected = {'day-valid': 0, 'clock-valid': 0, 'clock-missing': 1, 'orders.id.key-not-null': 0, 'orders.key-unique': 0}
    for settings in ["SET TIME ZONE 'UTC'; SET DateStyle TO 'ISO, YMD';", "SET TIME ZONE 'Pacific/Auckland'; SET DateStyle TO 'SQL, DMY';", "SET TIME ZONE 'America/Los_Angeles'; SET DateStyle TO 'German, DMY';"]:
        assert counts(settings) == expected
    checks.append('Exact installed generated count query accepts leap dates, six-digit mapped clocks and nulls under three native timezone/date-format sessions')
    execute("UPDATE public.orders SET day=DATE '2024-03-01', event=TIMESTAMP '2024-02-29 01:02:03.123457' WHERE source_id=1")
    changed = counts()
    assert changed['day-valid'] == 1 and changed['clock-valid'] == 1
    checks.append('Changing the date or one microsecond is counted as invalid by the installed required native rules')
    execute("UPDATE public.orders SET event=TIMESTAMP '2000-01-01 00:00:00' WHERE source_id=2")
    assert counts()['clock-missing'] == 2
    checks.append('Typed listed missing values and nullable clocks use the same native equality without string or timezone guessing')
    execute('DELETE FROM public.orders')
    assert all(value == 0 for value in counts().values())
    checks.append('Empty synthetic table returns one all-zero aggregate row; this does not qualify snapshot empty/copy policy')
    result = 'passed'
finally:
    if container:
        docker('rm', '-f', container)
    after = set(docker('ps', '-q').splitlines())
    args.proof.write_text(json.dumps({'apiVersion': 'ingestron.adf-temporal-postgresql-acceptance/v1', 'result': result, 'image': IMAGE, 'serverVersion': locals().get('version'), 'fixture': str(args.fixture), 'queryAsset': str(asset), 'querySha256': record['sha256'], 'providerCommit': seed['providerCommit'], 'providerModuleSha256': seed['providerModuleSha256'], 'checks': checks, 'containerRemoved': container not in after, 'preExistingContainersPreserved': before <= after, 'limits': ['Disposable synthetic DATE/plain TIMESTAMP(6) WITHOUT TIME ZONE native query counts only', 'Loopback driver without vendor TLS qualification; no Azure identity, ADF Copy/pipeline/deployment or source-native timezone qualification']}, indent=2) + '\n')
print(json.dumps({'result': result, 'checks': len(checks), 'proof': str(args.proof)}))
