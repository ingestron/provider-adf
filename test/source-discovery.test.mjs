import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { sourcePrepare, fileContracts } from "../src/source-discovery.mjs";
const python = existsSync(".venv/bin/python")
  ? resolve(".venv/bin/python")
  : "python3";
test("source selectors reject ambiguous paths, formats and workbook selection", () => {
  const base = {
    sourceId: "demo",
    sourceKind: "adls",
    format: "csv",
    datasets: [{ name: "orders", paths: ["orders.csv"] }],
  };
  assert.ok(sourcePrepare(base).artifacts["discover.py"]);
  for (const input of [
    { ...base, format: "sftp" },
    { ...base, datasets: [{ name: "orders", paths: ["../orders.csv"] }] },
    {
      ...base,
      format: "xlsx",
      datasets: [{ name: "orders", paths: ["orders.xlsx"] }],
    },
    { ...base, schemas: ["dbo"] },
    { ...base, sampleRows: 10001 },
  ])
    assert.throws(() => sourcePrepare(input));
  assert.ok(
    sourcePrepare({
      sourceId: "demo",
      sourceKind: "azure-sql",
      schemas: ["dbo"],
    }).artifacts["discover.mjs"],
  );
});
test("all format readers produce bounded metadata; unsafe XML, formulas, drift and duplicate headers fail", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "source-readers-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const script = String.raw`
import datetime, decimal, io, json, pathlib, runpy, sys
import pyarrow as pa, pyarrow.parquet as pq, openpyxl
m=runpy.run_path(sys.argv[1]); parse=m['parse_file']; infer=m['columns']; discover=m['discover']
for fmt,raw in [('csv',b'id,name\n1,\"A,B\"\n2,\n'),('tsv',b'id\tname\n1\tA\n2\t\n'),('json',b'[{"id":1,"name":"A"},{"id":2,"name":null}]'),('jsonl',b'{"id":1,"name":"A"}\n{"id":2,"name":null}\n'),('xml',b'<rows><row><id>1</id><name>A</name></row><row><id>2</id><name null="true"/></row></rows>')]:
    columns,stats=parse(raw,fmt,{},100)
    assert [c['name'] for c in columns]==['id','name']
    assert all(c['nullable'] for c in columns)
    assert stats['sampledRows']==2
    assert columns[0]['physicalType']==('STRING' if fmt in ['csv','tsv','xml'] else 'BIGINT')
columns,stats=parse(b'id\n1\n2\n3\n','csv',{},2); assert stats['truncated'] and stats['sampledRows']==2
nested=infer([{'nested':{'value':1},'items':[{'price':decimal.Decimal('1.20')}]},{'nested':{'value':None,'extra':'v'},'items':[]}])
assert nested[0]['logicalType']=='object' and nested[0]['properties'][1]['observedMissing']==1
assert nested[1]['items']['properties'][0]['physicalType']=='DECIMAL(3,2)'
for raw,fmt in [(b'a,a\n1,2\n','csv'),(b'a,b\n1\n','csv'),(b'[{"a":1,"a":2}]','json'),(b'<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x><row><a>&e;</a></row></x>','xml')]:
    try: parse(raw,fmt,{},100); raise AssertionError('accepted unsafe/ambiguous input')
    except (ValueError, __import__('defusedxml.common',fromlist=['DefusedXmlException']).DefusedXmlException): pass
buf=io.BytesIO(); pq.write_table(pa.table({'price':pa.array([decimal.Decimal('12.50')],type=pa.decimal128(10,2))}),buf)
cols,stats=parse(buf.getvalue(),'parquet',{},100); assert cols[0]['physicalType']=='DECIMAL(10,2)' and stats['rowCount']==1
config={'sourceId':'demo','sourceKind':'adls','format':'parquet','sampleRows':10,'datasets':[{'name':'orders','paths':['day=2026-09-01/a.parquet'],'partitionColumns':['day']}]}
result=discover(config,lambda _:buf.getvalue()); assert result['datasets'][0]['columns'][1]['evidence']=='declared-path-partition'
wb=openpyxl.Workbook();ws=wb.active;ws.title='orders';ws.append(['id','day']);ws.append([1,datetime.datetime(2026,9,1)]);b=io.BytesIO();wb.save(b)
cols,stats=parse(b.getvalue(),'xlsx',{'sheet':'orders'},100);assert cols[1]['logicalType']=='timestamp'
ws['A2']='=1+1';b=io.BytesIO();wb.save(b)
try: parse(b.getvalue(),'xlsx',{'sheet':'orders'},100);raise AssertionError('accepted formula')
except ValueError: pass
config={'sourceId':'demo','sourceKind':'adls','format':'csv','sampleRows':10,'datasets':[{'name':'orders','paths':['a.csv','b.csv']}]}
try: discover(config,lambda p:b'a\n1\n' if p=='a.csv' else b'b\n2\n');raise AssertionError('accepted drift')
except ValueError: pass
pathlib.Path(sys.argv[2]).write_text(json.dumps({'apiVersion':'ingestron.file-metadata/v1','sourceId':'demo','sourceKind':'adls','format':'json','datasets':[{'name':'orders','files':[{'path':'orders.json','sha256':'0'*64}],'columns':nested,'sampledRows':2,'truncated':False}]}))
`;
  const out = join(dir, "metadata.json");
  execFileSync(python, [
    "-c",
    script,
    resolve("runtime/discover-files.py"),
    out,
  ]);
  const result = fileContracts(JSON.parse(readFileSync(out, "utf8")));
  const contract = JSON.parse(result.artifacts["demo__orders.odcs.json"]);
  assert.equal(contract.schema[0].properties[0].logicalType, "object");
  assert.equal(contract.schema[0].properties[1].items.logicalType, "object");
  assert.equal(contract.schema[0].properties[0].required, false);
});
