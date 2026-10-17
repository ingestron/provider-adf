import { assemble } from "../src/project-assembly.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { render } from "../plugin/index.mjs";
import { adfScheduleFlows, scheduleManifestQuery } from "../src/schedules.mjs";
const definition = {
  apiVersion: "ingestron.schedule/v1",
  enabled: false,
  timeZone: "Pacific/Auckland",
  start: "2026-10-06T00:00:17Z",
  end: "2027-10-06T00:00:17Z",
  overlap: "native",
  missed: "native",
  recurrence: { kind: "daily", times: ["09:15", "17:45"] },
};
const boundary = (instant, localTime, offset) => ({
  instant,
  localTime,
  offset,
  ambiguous: false,
  possibleInstants: [{ instant, offset }],
});
const fixture = (standard = "snapshot-land@v1") => {
  const p = {
    project: "retail",
    digest: "a".repeat(64),
    selection: {},
    flows: [
      {
        id: "source",
        tables: { customers: {}, orders: {} },
        requires: {},
        schedule: structuredClone(definition),
      },
    ],
    bindings: { factory: { kind: "adf", factoryName: "adf-dev" } },
    scheduleBoundaries: {
      source: {
        apiVersion: "ingestron.schedule-boundaries/v1",
        definitionDigest: "b".repeat(64),
        timeZone: "Pacific/Auckland",
        clock: {
          implementation: "temporal-polyfill@0.5.1",
          timeZoneData: "test",
          icu: "test",
        },
        start: boundary(definition.start, "2026-10-06T13:00:17", "+13:00"),
        end: boundary(definition.end, "2027-10-06T13:00:17", "+13:00"),
      },
    },
    nodes: [],
  };
  for (const table of ["customers", "orders"])
    p.nodes.push({
      id: `source/${table}/copy`,
      flow: "source",
      table,
      platform: "adf",
      uses: "copy@v1",
      binding: "factory",
      needs: [],
      runtime: {
        options: {
          scheduleInputs: {
            source: {
              kind: "azure-sql",
              linkedService: "control",
              schema: "governance",
              view: "frozen_manifest",
            },
          },
        },
      },
      columns: [{ name: "id", type: "BIGINT", key: true, required: true }],
      source: {
        kind: "azure-sql",
        linkedService: "erp",
        schema: "dbo",
        table,
        consistency: "frozen-extract",
      },
      with: {
        standard,
        target: {
          linkedService: "lake",
          fileSystem: "landing",
          path: "retail",
        },
      },
    });
  return p;
};
const scheduled = (assets) => assets["adf-schedules.json"].value.schedules[0];
const props = (assets, name) =>
  assets["pipelines/" + name + ".json"].value.properties;
const utc = (p) => {
  const f = p.flows[0];
  f.schedule.timeZone = "UTC";
  p.scheduleBoundaries.source.timeZone = "UTC";
  for (const key of ["start", "end"]) {
    const val = f.schedule[key];
    p.scheduleBoundaries.source[key] = boundary(
      val,
      val.slice(0, -1),
      "+00:00",
    );
  }
  return p;
};

test("manual flow assets remain unchanged and no source-manifest input is requested", () => {
  const p = fixture();
  delete p.flows[0].schedule;
  delete p.scheduleBoundaries;
  const a = render(p);
  assert.equal(a["adf-schedules.json"], undefined);
  assert.equal(
    Object.keys(a).some((name) => name.startsWith("triggers/")),
    false,
  );
});
test("exact paired slots use separate native triggers and local bounds with a Windows zone", () => {
  const a = render(fixture()),
    s = scheduled(a);
  assert.equal(s.triggers.length, 2);
  assert.deepEqual(
    s.triggers.map((t) => t.properties.typeProperties.recurrence.schedule),
    [
      { hours: [9], minutes: [15] },
      { hours: [17], minutes: [45] },
    ],
  );
  for (const t of s.triggers) {
    const recurrence = t.properties.typeProperties.recurrence;
    assert.equal(recurrence.startTime, "2026-10-06T13:00:17");
    assert.equal(recurrence.endTime, "2027-10-06T13:00:17");
    assert.equal(recurrence.timeZone, "New Zealand Standard Time");
    assert.equal(Object.hasOwn(t.properties, "runtimeState"), false);
    assert.deepEqual(t.properties.pipelines, [
      {
        pipelineReference: {
          type: "PipelineReference",
          referenceName: s.dispatch.name,
        },
        parameters: { scheduledTime: "@trigger().scheduledTime" },
      },
    ]);
  }
  assert.equal(s.status, "not-created");
  assert.equal(s.activationIntent, "Stopped");
  const arm = a["adf-template.json"].value.resources.filter((r) =>
    r.type.endsWith("/triggers"),
  );
  assert.equal(arm.length, 2);
  assert.ok(
    arm.every(
      (r) =>
        r.dependsOn.length === 1 && r.dependsOn[0].includes(s.dispatch.name),
    ),
  );
});
test("all recurrence kinds preserve exact interval factors and selected weekdays/month dates", () => {
  for (const [recurrence, frequency, interval] of [
    [{ kind: "interval", minutes: 15 }, "Minute", 15],
    [{ kind: "interval", minutes: 1440 }, "Hour", 24],
    [{ kind: "interval", minutes: 1440 * 1000 }, "Day", 1000],
    [
      {
        kind: "weekly",
        weekDays: ["Monday", "Friday"],
        times: ["09:15", "17:45"],
      },
      "Week",
      1,
    ],
    [
      { kind: "monthly", monthDays: [1, 31], times: ["09:15", "17:45"] },
      "Month",
      1,
    ],
  ]) {
    const p = utc(fixture());
    p.flows[0].schedule.recurrence = recurrence;
    const s = scheduled(render(p));
    for (const t of s.triggers) {
      const r = t.properties.typeProperties.recurrence;
      assert.equal(r.frequency, frequency);
      assert.equal(r.interval, interval);
      assert.equal(r.startTime, definition.start);
      if (recurrence.weekDays)
        assert.deepEqual(r.schedule.weekDays, recurrence.weekDays);
      if (recurrence.monthDays)
        assert.deepEqual(r.schedule.monthDays, recurrence.monthDays);
    }
  }
  const p = utc(fixture());
  p.flows[0].schedule.recurrence = { kind: "interval", minutes: 60060 };
  assert.throws(() => render(p), /represent this elapsed interval exactly/);
});
test("UTC occurrence guards precede all manifest reads and enforce an exclusive end", () => {
  const a = render(fixture()),
    s = scheduled(a),
    dispatch = props(a, s.dispatch.name),
    guard = dispatch.activities[0];
  assert.equal(guard.name, "CheckScheduleWindow");
  assert.match(
    guard.typeProperties.expression.value,
    /greaterOrEquals\(ticks\(pipeline\(\)\.parameters\.scheduledTime\)/,
  );
  assert.match(
    guard.typeProperties.expression.value,
    /less\(ticks\(pipeline\(\)\.parameters\.scheduledTime\)/,
  );
  assert.match(guard.typeProperties.expression.value, /2027-10-06T00:00:17Z/);
  assert.equal(guard.typeProperties.ifFalseActivities[0].type, "Fail");
  assert.equal(
    dispatch.activities.find((x) => x.name === "ScheduleInputs").dependsOn[0]
      .activity,
    "CheckScheduleWindow",
  );
  const run = dispatch.activities.find((x) => x.type === "ForEach");
  assert.equal(run.dependsOn[0].activity, "CheckScheduleInputs");
});
test("snapshots require fresh source-authoritative counts and validate the complete manifest before dispatch", () => {
  const a = render(fixture()),
    s = scheduled(a),
    dispatch = props(a, s.dispatch.name),
    lookup = dispatch.activities.find((x) => x.type === "Lookup");
  assert.equal(lookup.typeProperties.firstRowOnly, false);
  assert.equal(lookup.policy.secureOutput, true);
  const sql = lookup.typeProperties.source.sqlReaderQuery;
  assert.match(sql, /SELECT TOP \(3\)/);
  assert.match(sql, /COUNT_BIG\(DISTINCT/);
  assert.match(sql, /TRY_CONVERT\(int,\[expectedRowCount\]\)/);
  assert.match(sql, /\[governance\]\.\[frozen_manifest\]/);
  assert.match(sql, /Latin1_General_100_BIN2/);
  assert.match(sql, /NOT EXISTS/);
  assert.match(sql, /expectedRowCount\] < 1/);
  const cases = dispatch.activities.find((x) => x.type === "ForEach")
    .typeProperties.activities[0].typeProperties.cases;
  assert.deepEqual(
    cases.map((x) => x.value),
    ["source/customers", "source/orders"],
  );
  for (const c of cases)
    assert.equal(
      c.activities[0].typeProperties.parameters.expectedRowCount.value,
      "@int(item().expectedRowCount)",
    );
  for (const target of s.targets)
    assert.deepEqual(props(a, target).parameters.expectedRowCount, {
      type: "Int",
    });
  const p = fixture();
  for (const n of p.nodes) n.runtime.options = {};
  assert.throws(() => render(p), /source-owner manifest view/);
});
test("publication identities are read from the manifest and never derived from the trigger or recovery pipeline", () => {
  const p = fixture("snapshot-to-databricks@v1");
  for (const n of p.nodes)
    n.with.publication = {
      linkedService: "dbx",
      notebookPath: "/Workspace/reviewed/publish",
      protocol: "ingestron.snapshot-publication/v1",
    };
  p.bindings.lakehouse = {
    kind: "databricks",
    host: "https://example.invalid",
    catalog: "synthetic",
  };
  for (const n of p.nodes) {
    n.with.target.storageAccount = "synthetic";
    n.contract = { version: "1.0.0" };
  }
  const a = render(p),
    s = scheduled(a),
    dispatch = props(a, s.dispatch.name),
    sql = dispatch.activities.find((x) => x.type === "Lookup").typeProperties
      .source.sqlReaderQuery;
  assert.ok(s.targets.every((name) => !name.endsWith("_publish")));
  assert.match(sql, /\[deliveryId\]/);
  assert.match(sql, /\[capturedAt\]/);
  assert.match(sql, /\[version\] < 1/);
  const invoked = dispatch.activities.find((x) => x.type === "ForEach")
    .typeProperties.activities[0].typeProperties.cases[0].activities[0]
    .typeProperties.parameters;
  assert.equal(invoked.version.value, "@int(item().version)");
  assert.equal(invoked.deliveryId.value, "@item().deliveryId");
  assert.equal(invoked.capturedAt.value, "@item().capturedAt");
  assert.equal(Object.hasOwn(invoked, "runId"), false);
});
test("metadata coordinator invocations select only the scheduled flow's table subset", () => {
  const p = fixture("metadata-snapshot-land@v1");
  for (const n of p.nodes) n.with.group = "shared";
  const manual = { ...structuredClone(p.flows[0]), id: "manual" };
  delete manual.schedule;
  p.flows.push(manual);
  p.nodes.push(
    ...p.nodes.map((n) => ({
      ...structuredClone(n),
      flow: "manual",
      id: "manual/" + n.table + "/copy",
    })),
  );
  const a = render(p),
    s = scheduled(a);
  assert.deepEqual(s.targets, ["retail_md_shared_run"]);
  assert.ok(!s.targets.some((x) => x.endsWith("_worker")));
  const invoked = props(a, s.dispatch.name).activities.find(
    (x) => x.type === "ExecutePipeline",
  );
  assert.deepEqual(invoked.typeProperties.parameters.tables, [
    "source/customers",
    "source/orders",
  ]);
  assert.ok(
    !invoked.typeProperties.parameters.expectedCounts.value.includes("manual/"),
  );
  assert.match(
    invoked.typeProperties.parameters.expectedCounts.value,
    /output\.value\[0\]/,
  );
});
test("watermark schedules invoke only the durable primary and require no snapshot count view", () => {
  const p = fixture("watermark-append-land@v1");
  for (const n of p.nodes) {
    n.runtime.options = {};
    n.source.consistency = "ordered-committed-append";
    n.with.watermark = {
      column: "id",
      initial: "0",
      batchSize: 2,
      namespace: n.table + "_v1",
      consistency: "ordered-committed-append",
      controlLinkedService: "control",
    };
  }
  const a = render(p),
    s = scheduled(a),
    dispatch = props(a, s.dispatch.name);
  assert.ok(s.targets.every((name) => !name.endsWith("_worker")));
  assert.equal(
    dispatch.activities.some((x) => x.type === "Lookup"),
    false,
  );
  for (const c of dispatch.activities.find((x) => x.type === "ForEach")
    .typeProperties.activities[0].typeProperties.cases)
    assert.deepEqual(c.activities[0].typeProperties.parameters, {});
});
test("all100 compiled tables respect the25-case limit and native pipeline activity limit", () => {
  const p = fixture();
  p.nodes = [];
  p.flows[0].tables = {};
  const base = fixture().nodes[0];
  for (let i = 0; i < 100; i++) {
    const table = "table_" + String(i).padStart(3, "0");
    p.flows[0].tables[table] = {};
    p.nodes.push({
      ...structuredClone(base),
      table,
      id: "source/" + table + "/copy",
      source: { ...base.source, table },
    });
  }
  const a = render(p),
    s = scheduled(a),
    dispatch = props(a, s.dispatch.name);
  const switches = dispatch.activities.find((x) => x.type === "ForEach")
    .typeProperties.activities;
  assert.equal(switches.length, 4);
  assert.ok(switches.every((x) => x.typeProperties.cases.length === 25));
  assert.match(
    dispatch.activities.find((x) => x.type === "Lookup").typeProperties.source
      .sqlReaderQuery,
    /TOP \(101\)/,
  );
});
test("unsupported policies, partial flows, bad sources and ambiguous boundaries fail without guessing", () => {
  const changes = [
    (p) => {
      p.flows[0].schedule.overlap = "skip";
    },
    (p) => {
      p.flows[0].schedule.missed = "latest";
    },
    (p) => {
      p.flows[0].schedule.daylightSaving = { gap: "skip", fold: "earlier" };
    },
    (p) => {
      p.selection.table = "orders";
    },
    (p) => {
      p.selection.step = "copy";
    },
    (p) => {
      p.nodes.pop();
    },
    (p) => {
      delete p.scheduleBoundaries;
    },
    (p) => {
      p.scheduleBoundaries.source.start.ambiguous = true;
    },
    (p) => {
      p.nodes[0].runtime.options.scheduleInputs.source.view =
        "v; DROP TABLE source";
    },
    (p) => {
      p.nodes[0].runtime.options.scheduleInputs.source.query = "SELECT 1";
    },
  ];
  for (const change of changes) {
    const p = fixture();
    change(p);
    assert.throws(() => render(p));
  }
  const p = fixture();
  p.flows[0].schedule.enabled = true;
  assert.equal(scheduled(render(p)).activationIntent, "Started");
  assert.equal(adfScheduleFlows({ ...p, flows: [] }).length, 0);
});

test("project assembly retains schedules and rejects missing, moved, modified or unowned triggers and dispatch targets", () => {
  const plan = fixture(),
    assets = render(plan);
  const files = Object.fromEntries(
    Object.entries(assets).map(([name, asset]) => [
      name,
      asset.format === "json"
        ? JSON.stringify(asset.value)
        : asset.format === "text"
          ? asset.value
          : "ignored",
    ]),
  );
  const input = {
    phase: "assemble",
    project: plan.project,
    environment: "dev",
    configuration: "landing",
    scope: { id: "full", partial: false, flows: ["source"] },
    binding: plan.bindings.factory,
    nativeFiles: files,
    connections: [],
  };
  const result = assemble(input);
  assert.equal(
    result.artifacts["adf-schedules.json"],
    files["adf-schedules.json"],
  );
  const schedule = scheduled(assets),
    trigger = schedule.triggers[0].file;
  const mutate = (file, change) => {
    const value = JSON.parse(file);
    change(value);
    return JSON.stringify(value);
  };
  for (const change of [
    (f) => {
      delete f["adf-schedules.json"];
    },
    (f) => {
      delete f[trigger];
    },
    (f) => {
      f[trigger] = mutate(f[trigger], (value) => {
        value.name = "moved";
      });
    },
    (f) => {
      f[trigger] = mutate(f[trigger], (value) => {
        value.properties.typeProperties.recurrence.interval = 7;
      });
    },
    (f) => {
      f["triggers/foreign.json"] = f[trigger];
    },
    (f) => {
      f["adf-template.json"] = mutate(f["adf-template.json"], (value) => {
        value.resources.filter((r) =>
          r.type.endsWith("/triggers"),
        )[0].dependsOn = [];
      });
    },
    (f) => {
      f[schedule.dispatch.file] = mutate(f[schedule.dispatch.file], (value) => {
        value.properties.activities[0].typeProperties.expression.value =
          "@true";
      });
    },
  ]) {
    const altered = structuredClone(input);
    change(altered.nativeFiles);
    assert.throws(() => assemble(altered));
  }
  const foreign = structuredClone(input);
  foreign.scope.flows = ["manual"];
  assert.throws(() => assemble(foreign), /foreign/);
});

test("manifest cohort matching retains trailing-space distinctions under SQL comparison rules", () => {
  const entry = adfScheduleFlows(fixture())[0];
  const query = scheduleManifestQuery(entry);
  assert.match(
    query,
    /WHERE \(\[tableId\]\+N'#'\) COLLATE Latin1_General_100_BIN2 IN \(N'source\/customers#', N'source\/orders#'\)/,
  );
  assert.match(
    query,
    /COUNT_BIG\(DISTINCT \[tableId\] COLLATE Latin1_General_100_BIN2\)/,
  );
});
