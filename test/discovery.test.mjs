import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  discoveryPrepare,
  discoveryContracts,
  metadataQuery,
} from "../src/discovery.mjs";
import { runner } from "../src/deployment-runner.mjs";
const load = (name, file) =>
  JSON.parse(readFileSync(`examples/discovery-showcase/${name}/${file}.json`));
test("three connection kinds prepare bounded metadata-only pipelines and reviewable drafts", () => {
  for (const name of ["northwind_azure", "northwind_private", "pagila"]) {
    const input = load(name, "prepare"),
      bundle = discoveryPrepare(input),
      template = JSON.parse(bundle.artifacts["template.json"]);
    assert.equal(template.resources.length, 3);
    assert.ok(
      template.resources.every((r) =>
        r.name.startsWith(input.factoryName + "/ingestron_" + input.useCase),
      ),
    );
    assert.doesNotMatch(JSON.stringify(template), /ExecuteDataFlow/);
    assert.match(bundle.artifacts["metadata-query.sql"], /IN \('/);
    const copy = template.resources[2].properties.activities[0];
    assert.equal(copy.type, "Copy");
    assert.equal(
      copy.typeProperties.sink.formatSettings.filePattern,
      "arrayOfObjects",
    );
    assert.equal(copy.outputs[0].parameters.runId.value, "@pipeline().RunId");
    const imported = load(name, "metadata-fixture"),
      result = discoveryContracts(imported);
    const contracts = Object.entries(result.artifacts)
      .filter(([k]) => k.endsWith(".odcs.json"))
      .map(([, v]) => JSON.parse(v));
    assert.ok(contracts.length >= 2);
    assert.ok(
      contracts.every(
        (c) =>
          c.status === "draft" &&
          c.schema[0].properties.every((p) => !p.primaryKey),
      ),
    );
    const accepted = discoveryContracts({
      ...imported,
      acceptDeclaredKeys: true,
    });
    assert.ok(
      Object.values(accepted.artifacts).some((v) =>
        v.includes('"primaryKey": true'),
      ),
    );
  }
});
test("discovery refuses injection, ambiguous metadata and lossy numeric mappings", () => {
  assert.throws(() => metadataQuery("azure-sql", ["dbo';DROP TABLE x;--"]));
  assert.throws(() =>
    metadataQuery("postgresql", ["public"], ["customer';delete"]),
  );
  const input = load("pagila", "metadata-fixture");
  assert.throws(
    () =>
      discoveryContracts({ ...input, rows: [input.rows[0], input.rows[0]] }),
    /Duplicate/,
  );
  assert.throws(
    () =>
      discoveryContracts({
        ...input,
        rows: [
          { ...input.rows[0], data_type: "numeric", precision: 39, scale: 2 },
        ],
      }),
    /precision/,
  );
  assert.throws(
    () =>
      discoveryContracts({
        ...input,
        rows: [{ ...input.rows[0], data_type: "unknown" }],
      }),
    /Unsupported/,
  );
  assert.throws(
    () =>
      discoveryContracts({
        ...input,
        rows: [{ ...input.rows[0], nullable: "false" }],
      }),
    /boolean/,
  );
  const rows = [
    { ...input.rows[0], table_name: "Order Details" },
    { ...input.rows[0], table_name: "Order_Details" },
  ];
  assert.throws(() => discoveryContracts({ ...input, rows }), /collision/);
});
test("new factory is explicit; customer-side runner is valid Python and defaults to no execution on import", (t) => {
  const input = load("northwind_azure", "prepare"),
    bundle = discoveryPrepare({ ...input, mode: "new-factory" });
  assert.equal(
    JSON.parse(bundle.artifacts["template.json"]).resources[0].identity.type,
    "SystemAssigned",
  );
  const dir = mkdtempSync(join(tmpdir(), "adf-runner-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "deploy.py");
  writeFileSync(path, runner);
  execFileSync("python3", ["-m", "py_compile", path]);
  const result = execFileSync("python3", [path, "--help"], {
    encoding: "utf8",
  });
  assert.match(result, /approve/);
  assert.match(result, /download/);
});

test("deployment runner rejects unowned resources and requires a current approved plan digest without cloud calls", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "adf-runner-review-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const input = load("northwind_azure", "prepare");
  const bundle = discoveryPrepare(input);
  for (const [name, value] of Object.entries(bundle.artifacts))
    writeFileSync(join(dir, name), value);
  const script = String.raw`
import contextlib, io, json, pathlib, runpy, sys
module=runpy.run_path(sys.argv[1])
main=module['main']; calls=[]; owned=True
config=json.loads((pathlib.Path(sys.argv[1]).parent/'deployment.json').read_text())
def fake(*args):
    calls.append(args)
    if args[:2]==('resource','list'): return [{'name':config['factoryName']}]
    if args[:2]==('deployment','group'): return {'changes':[]}
    url=args[args.index('--url')+1]
    if '/linkedservices?' in url: return {'value':[{'name':config['sourceLinkedService'],'properties':{'type':'AzureSqlDatabase'}},{'name':config['sinkLinkedService'],'properties':{'type':'AzureBlobFS'}}]}
    if '/datasets?' in url: return {'value':[{'name':config['resourceNames'][0],'properties':{'annotations':['ingestron:'+config['useCase']] if owned else []}}]}
    return {'value':[]}
main.__globals__['az']=fake
base=['--subscription','00000000-0000-0000-0000-000000000001','--resource-group','demo']
sys.argv=['deploy.py','plan',*base]
with contextlib.redirect_stdout(io.StringIO()) as output: main()
digest=json.loads(output.getvalue())['digest']
sys.argv=['deploy.py','apply',*base,'--approve','wrong']
try: main(); raise AssertionError('accepted wrong digest')
except RuntimeError as error: assert 'reviewed digest' in str(error)
assert not any(c[:3]==('deployment','group','create') for c in calls)
sys.argv=['deploy.py','apply',*base,'--approve',digest]
with contextlib.redirect_stdout(io.StringIO()): main()
assert any(c[:3]==('deployment','group','create') for c in calls)
owned=False
sys.argv=['deploy.py','plan',*base]
try: main(); raise AssertionError('accepted unowned resource')
except RuntimeError as error: assert 'unowned' in str(error)
print('Mocked deployment plan/apply/ownership passed')
`;
  execFileSync("python3", ["-c", script, join(dir, "deploy.py")]);
});

test("download accepts ADF UTF-8 BOM and plain JSON without overwriting prior evidence", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "adf-download-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bundle = discoveryPrepare(load("northwind_azure", "prepare"));
  for (const [name, value] of Object.entries(bundle.artifacts))
    writeFileSync(join(dir, name), value);
  const script = String.raw`
import contextlib, io, json, pathlib, runpy, sys
root=pathlib.Path(sys.argv[1]).parent
main=runpy.run_path(sys.argv[1])['main']
config=json.loads((root/'deployment.json').read_text())
rows=[{'schema_name':'dbo','table_name':'Customers','column_name':'CustomerID'}]
def fake(*args):
    if args[:2]==('resource','list'): return [{'name':config['factoryName']}]
    if args[0]=='rest': return {'status':'Succeeded','pipelineName':config['pipelineName']}
    if args[:4]==('storage','fs','file','download'):
        pathlib.Path(args[args.index('--destination')+1]).write_bytes(prefix+json.dumps(rows).encode('utf-8'))
        return {}
    raise AssertionError(args)
main.__globals__['az']=fake
for i,prefix in enumerate([b'\xef\xbb\xbf', b'']):
    run_id='00000000-0000-0000-0000-00000000000'+str(i)
    sys.argv=['deploy.py','download','--subscription','00000000-0000-0000-0000-000000000001','--resource-group','demo','--run-id',run_id,'--storage-account','demo']
    with contextlib.redirect_stdout(io.StringIO()): main()
    imported=json.loads((root/(run_id+'-import.json')).read_text())
    assert imported['rows']==rows
    assert imported['sourceKind']=='azure-sql'
    try: main(); raise AssertionError('overwrote prior evidence')
    except RuntimeError as error: assert 'already exists' in str(error)
`;
  execFileSync("python3", ["-c", script, join(dir, "deploy.py")]);
});

test("native connection flows get a metadata pipeline for their linked service", async () => {
  const { discoveryRoute } = await import("../src/discovery.mjs");
  const result = discoveryRoute({
    flow: "sales_bridge",
    kind: "oracle",
    source: { kind: "oracle", linkedService: "erp_oracle" },
    tables: {
      customers: { schema: "SALES", table: "CUSTOMERS" },
      orders: { schema: "SALES", table: "ORDERS" },
    },
    target: { linkedService: "landing_adls", fileSystem: "landing" },
    binding: { kind: "adf", factoryName: "adf-retail-dev" },
  });
  const deployment = JSON.parse(result.artifacts["deployment.json"]);
  assert.equal(deployment.sourceLinkedService, "erp_oracle");
  assert.equal(deployment.mode, "existing-factory");
  assert.match(result.artifacts["metadata-query.sql"], /all_tab_columns/);
  assert.match(
    result.artifacts["metadata-query.sql"],
    /c\.table_name IN \('CUSTOMERS','ORDERS'\)/,
  );
  const template = JSON.parse(result.artifacts["template.json"]);
  assert.equal(
    template.resources.find((r) => r.name.endsWith("_source")).properties.type,
    "OracleTable",
  );
  assert.match(result.next, /landing\/discovery\/sales_bridge/);
  assert.throws(
    () =>
      discoveryRoute({
        flow: "crm",
        kind: "salesforce",
        source: { kind: "salesforce", linkedService: "sf" },
        tables: { a: { object: "Account" } },
        target: { linkedService: "l", fileSystem: "landing" },
        binding: { factoryName: "adf-crm-dev" },
      }),
    /use a portable connector/,
  );
});
