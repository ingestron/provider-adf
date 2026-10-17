import { windowsZones } from "./windows-zones.mjs";
import { metadataNames, metadataStandard } from "./metadata.mjs";
import { sqlSources } from "./sql-sources.mjs";
const check = (ok, message) => {
  if (!ok) throw Error(message);
};
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const resource = (value) =>
  typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_-]{0,100}$/.test(value);
const identifier = (value) =>
  typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(value);
const instant = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value);
const expr = (value) => ({ type: "Expression", value });
const after = (name) => [
  { activity: name, dependencyConditions: ["Succeeded"] },
];
const fail = (name, message) => ({
  name,
  type: "Fail",
  typeProperties: { message, errorCode: "INGESTRON_SCHEDULE_INPUT" },
});
const gate = (name, condition, message, dependency) => ({
  name,
  type: "IfCondition",
  ...(dependency ? { dependsOn: after(dependency) } : {}),
  typeProperties: {
    expression: expr(condition),
    ifTrueActivities: [],
    ifFalseActivities: [fail(name + "Failed", message)],
  },
});
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const ref = (referenceName, type = "PipelineReference") => ({
  type,
  referenceName,
});
const primary = (plan, node) =>
  node.with.standard === metadataStandard
    ? metadataNames(plan.project, node.with.group).coordinator
    : `${plan.project}_${node.flow}_${node.table}`;

/** Reviewed native semantics, never an implicit conversion of portable policies. */
export function adfScheduleFlows(plan) {
  const entries = [];
  for (const flow of plan.flows ?? []) {
    const schedule = flow.schedule;
    if (!schedule) continue;
    check(
      Object.keys(schedule).every((key) =>
        [
          "apiVersion",
          "enabled",
          "timeZone",
          "start",
          "end",
          "recurrence",
          "overlap",
          "missed",
          "daylightSaving",
        ].includes(key),
      ),
      "Unsupported ADF schedule fields",
    );
    check(
      schedule.apiVersion === "ingestron.schedule/v1" &&
        typeof schedule.enabled === "boolean",
      "Use a reviewed flow schedule",
    );
    check(
      schedule.overlap === "native" &&
        schedule.missed === "native" &&
        !schedule.daylightSaving,
      "ADF schedules require explicit native clock, overlap and missed-run policies",
    );
    check(
      !plan.selection?.table && !plan.selection?.step,
      "ADF schedules require the complete flow selection",
    );
    const nodes = plan.nodes
      .filter((node) => node.flow === flow.id)
      .sort((a, b) => compare(a.table, b.table));
    const tables = Object.keys(flow.tables ?? {}).sort(compare);
    check(
      nodes.length > 0 &&
        nodes.length <= 100 &&
        nodes.length === tables.length &&
        nodes.every((node, index) => node.table === tables[index]),
      "ADF schedules require every reviewed table exactly once",
    );
    const metadata = plan.scheduleBoundaries?.[flow.id];
    check(
      metadata?.apiVersion === "ingestron.schedule-boundaries/v1" &&
        metadata.timeZone === schedule.timeZone &&
        /^[a-f0-9]{64}$/.test(metadata.definitionDigest ?? ""),
      "ADF schedules require compiler-resolved boundary metadata",
    );
    const zone = windowsZones[schedule.timeZone?.toLowerCase()];
    check(zone, "ADF has no pinned Windows mapping for this IANA zone");
    const bound = (value, expected) => {
      check(
        instant(expected) &&
          value?.instant === expected &&
          typeof value.localTime === "string" &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value.localTime),
        "ADF schedule boundary does not match the reviewed UTC instant",
      );
      check(
        value.ambiguous === false &&
          value.possibleInstants?.length === 1 &&
          value.possibleInstants[0].instant === expected &&
          value.possibleInstants[0].offset === value.offset,
        "ADF cannot preserve an ambiguous native wall-clock boundary; review a boundary with one interpretation",
      );
      return zone === "UTC" ? expected : value.localTime;
    };
    const startTime = bound(metadata.start, schedule.start);
    const endTime = schedule.end
      ? bound(metadata.end, schedule.end)
      : undefined;
    check(
      !!metadata.end === !!schedule.end,
      "ADF optional end metadata must match the reviewed schedule",
    );
    const clock = {
      startTime,
      ...(endTime ? { endTime } : {}),
      timeZone: zone,
    };
    const recurrence = schedule.recurrence;
    const recurrences = [];
    const fields =
      recurrence?.kind === "interval"
        ? ["kind", "minutes"]
        : recurrence?.kind === "weekly"
          ? ["kind", "times", "weekDays"]
          : recurrence?.kind === "monthly"
            ? ["kind", "times", "monthDays"]
            : ["kind", "times"];
    check(
      object(recurrence) &&
        Object.keys(recurrence).every((key) => fields.includes(key)),
      "Unsupported ADF recurrence fields",
    );
    if (recurrence?.kind === "interval") {
      check(
        schedule.timeZone === "UTC" &&
          Number.isSafeInteger(recurrence.minutes) &&
          recurrence.minutes > 0,
        "ADF elapsed intervals require literal UTC and whole positive minutes",
      );
      const factor = [
        ["Minute", 1],
        ["Hour", 60],
        ["Day", 1440],
        ["Week", 10080],
      ].find(
        ([, size]) =>
          recurrence.minutes % size === 0 && recurrence.minutes / size <= 1000,
      );
      check(
        factor,
        "ADF cannot represent this elapsed interval exactly within its native multiplier limit",
      );
      recurrences.push({
        ...clock,
        frequency: factor[0],
        interval: recurrence.minutes / factor[1],
      });
    } else {
      check(
        ["daily", "weekly", "monthly"].includes(recurrence?.kind),
        "Unsupported ADF recurrence",
      );
      check(
        Array.isArray(recurrence.times) &&
          recurrence.times.length > 0 &&
          recurrence.times.length <= 100 &&
          new Set(recurrence.times).size === recurrence.times.length &&
          recurrence.times.every(
            (time) =>
              typeof time === "string" &&
              /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time),
          ),
        "Use exact distinct HH:mm slots",
      );
      let days = {};
      if (recurrence.kind === "weekly") {
        const values = [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ];
        check(
          Array.isArray(recurrence.weekDays) &&
            recurrence.weekDays.length > 0 &&
            new Set(recurrence.weekDays).size === recurrence.weekDays.length &&
            recurrence.weekDays.every((day) => values.includes(day)),
          "Use distinct reviewed weekdays",
        );
        days = { weekDays: recurrence.weekDays };
      }
      if (recurrence.kind === "monthly") {
        check(
          Array.isArray(recurrence.monthDays) &&
            recurrence.monthDays.length > 0 &&
            new Set(recurrence.monthDays).size ===
              recurrence.monthDays.length &&
            recurrence.monthDays.every(
              (day) => Number.isInteger(day) && day >= 1 && day <= 31,
            ),
          "Use distinct reviewed month days",
        );
        days = { monthDays: recurrence.monthDays };
      }
      for (const slot of [...recurrence.times].sort(compare)) {
        const [hour, minute] = slot.split(":").map(Number);
        recurrences.push({
          ...clock,
          frequency: { daily: "Day", weekly: "Week", monthly: "Month" }[
            recurrence.kind
          ],
          interval: 1,
          schedule: { hours: [hour], minutes: [minute], ...days },
        });
      }
    }
    const inputs = nodes[0].runtime?.options?.scheduleInputs?.[flow.id];
    check(
      nodes.every(
        (node) =>
          JSON.stringify(node.runtime?.options?.scheduleInputs?.[flow.id]) ===
          JSON.stringify(inputs),
      ),
      "One reviewed schedule input source per flow",
    );
    const needsInputs = nodes.some((node) =>
      [
        "snapshot-land@v1",
        "snapshot-to-databricks@v1",
        metadataStandard,
      ].includes(node.with.standard),
    );
    check(
      !needsInputs || object(inputs),
      "Scheduled snapshots require a reviewed source-owner manifest view for fresh expected counts and publication identities",
    );
    if (inputs) {
      check(
        needsInputs,
        "This schedule has no runtime parameters requiring a manifest view",
      );
      check(
        Object.keys(inputs).every((key) =>
          ["kind", "linkedService", "schema", "view"].includes(key),
        ) &&
          ["azure-sql", "sql-server"].includes(inputs.kind) &&
          resource(inputs.linkedService) &&
          identifier(inputs.schema) &&
          identifier(inputs.view),
        "Use a reviewed existing Azure SQL or SQL Server schedule manifest view",
      );
    }
    entries.push({
      flow: flow.id,
      definition: schedule,
      boundaries: metadata,
      nodes,
      recurrences,
      inputs,
    });
  }
  return entries;
}

/** One bounded read of a frozen source-owner manifest; no arbitrary SQL input.
 * Bad/missing/duplicate rows produce no dispatchable records. CTE reads require
 * a stable manifest view, as does the frozen extract being copied. */
export function scheduleManifestQuery(entry) {
  const ids = entry.nodes.map((node) => `${node.flow}/${node.table}`);
  const literal = (value) => "N'" + value.replaceAll("'", "''") + "'";
  const id = "[tableId] COLLATE Latin1_General_100_BIN2";
  // SQL equality pads trailing spaces even under BIN2. The sentinel makes an
  // altered ID differ before those padding rules can apply.
  const exactId = "([tableId]+N'#') COLLATE Latin1_General_100_BIN2";
  const publication = entry.nodes.some(
    (node) => node.with.standard === "snapshot-to-databricks@v1",
  );
  const fields =
    "[tableId], [expectedRowCount]" +
    (publication
      ? ", [deliveryId], [version], [capturedAt], [initialiseIndex]"
      : "");
  const invalid = [
    "[expectedRowCount] IS NULL",
    "TRY_CONVERT(int,[expectedRowCount]) IS NULL",
    "[expectedRowCount] <> TRY_CONVERT(int,[expectedRowCount])",
    ...entry.nodes.map(
      (node) =>
        `(${id} = ${literal(`${node.flow}/${node.table}`)} AND [expectedRowCount] < ${node.with.allowEmpty ? 0 : 1})`,
    ),
  ];
  if (publication)
    invalid.push(
      "[version] IS NULL",
      "TRY_CONVERT(int,[version]) IS NULL",
      "[version] <> TRY_CONVERT(int,[version])",
      "[version] < 1",
      "[deliveryId] IS NULL",
      "LEN([deliveryId]+N'#') NOT BETWEEN 2 AND 129",
      "LEFT([deliveryId],1) COLLATE Latin1_General_100_BIN2 NOT LIKE N'[A-Za-z0-9]'",
      "[deliveryId] COLLATE Latin1_General_100_BIN2 LIKE N'%[^A-Za-z0-9._-]%'",
      "[capturedAt] IS NULL",
      "LEN([capturedAt]+N'#') <> 21",
      "TRY_CONVERT(datetime2(0),[capturedAt],127) IS NULL",
      "CONVERT(nvarchar(19),TRY_CONVERT(datetime2(0),[capturedAt],127),126)+N'Z' <> [capturedAt] COLLATE Latin1_General_100_BIN2",
      "[initialiseIndex] IS NULL",
      "TRY_CONVERT(int,[initialiseIndex]) NOT IN (0,1)",
      "TRY_CONVERT(int,[initialiseIndex]) IS NULL",
      "[initialiseIndex] <> TRY_CONVERT(int,[initialiseIndex])",
    );
  return `WITH [manifest] AS (SELECT TOP (${ids.length + 1}) ${fields} FROM [${entry.inputs.schema}].[${entry.inputs.view}] WHERE ${exactId} IN (${ids.map((value) => literal(value + "#")).join(", ")}))\nSELECT [tableId], TRY_CONVERT(int,[expectedRowCount]) AS [expectedRowCount]${publication ? ", [deliveryId], TRY_CONVERT(int,[version]) AS [version], [capturedAt], TRY_CONVERT(bit,[initialiseIndex]) AS [initialiseIndex]" : ""} FROM [manifest]\nWHERE (SELECT COUNT_BIG(*) FROM [manifest]) = ${ids.length} AND (SELECT COUNT_BIG(DISTINCT ${id}) FROM [manifest]) = ${ids.length}\nAND NOT EXISTS (SELECT 1 FROM [manifest] WHERE ${invalid.join(" OR ")})\nORDER BY CASE ${id} ${ids.map((value, index) => `WHEN ${literal(value)} THEN ${index}`).join(" ")} END`;
}

export function renderAdfSchedules(plan, add, assets) {
  const entries = adfScheduleFlows(plan);
  if (!entries.length) return;
  const manifests = [];
  for (const entry of entries) {
    const prefix = `${plan.project}_${entry.flow}_schedule`,
      dispatch = prefix + "_dispatch",
      dataset = prefix + "_inputs";
    check(
      resource(dispatch) && resource(dataset),
      "ADF schedule resource name exceeds its native limit",
    );
    check(
      !assets[`pipelines/${dispatch}.json`] &&
        !assets[`datasets/${dataset}.json`],
      "ADF schedule resource collides with an ingestion asset",
    );
    const targets = [
      ...new Set(entry.nodes.map((node) => primary(plan, node))),
    ].sort(compare);
    for (const target of targets)
      check(
        assets[`pipelines/${target}.json`],
        "ADF schedule target is not an owned generated pipeline",
      );
    const bounds = `greaterOrEquals(ticks(pipeline().parameters.scheduledTime),ticks('${entry.definition.start}'))`;
    const window = entry.definition.end
      ? `and(${bounds},less(ticks(pipeline().parameters.scheduledTime),ticks('${entry.definition.end}')))`
      : bounds;
    const activities = [
      gate(
        "CheckScheduleWindow",
        "@" + window,
        "Scheduled occurrence is outside the reviewed UTC bounds; no source read or copy is allowed",
      ),
    ];
    const policy = {
      timeout: entry.nodes[0].runtime.options?.timeout ?? "00.01:00:00",
      retry: 0,
      secureInput: true,
      secureOutput: true,
    };
    let dependency = "CheckScheduleWindow";
    if (entry.inputs) {
      const sql = sqlSources[entry.inputs.kind];
      add("datasets", dataset, {
        type: sql.dataset,
        linkedServiceName: ref(
          entry.inputs.linkedService,
          "LinkedServiceReference",
        ),
        typeProperties: {
          schema: entry.inputs.schema,
          table: entry.inputs.view,
        },
      });
      activities.push({
        name: "ScheduleInputs",
        type: "Lookup",
        dependsOn: after(dependency),
        policy,
        typeProperties: {
          source: {
            type: sql.source,
            [sql.query]: scheduleManifestQuery(entry),
            ...sql.options,
          },
          dataset: ref(dataset, "DatasetReference"),
          firstRowOnly: false,
        },
      });
      activities.push(
        gate(
          "CheckScheduleInputs",
          `@equals(length(activity('ScheduleInputs').output.value),${entry.nodes.length})`,
          "Source-owner schedule manifest is missing, duplicated or invalid; nothing was copied",
          "ScheduleInputs",
        ),
      );
      dependency = "CheckScheduleInputs";
    }
    const invoke = (name, parameters, index) => ({
      name: "Invoke" + index,
      type: "ExecutePipeline",
      policy: { secureInput: true },
      typeProperties: {
        pipeline: ref(name),
        waitOnCompletion: true,
        parameters,
      },
    });
    if (entry.nodes.every((node) => node.with.standard === metadataStandard)) {
      for (const [index, target] of targets.entries()) {
        const members = entry.nodes.filter(
          (node) => primary(plan, node) === target,
        );
        const pieces = [];
        for (const node of members) {
          const ordinal = entry.nodes.indexOf(node),
            key = `${node.flow}/${node.table}`;
          pieces.push(
            `'${pieces.length ? "," : ""}${JSON.stringify(key)}:'`,
            `string(activity('ScheduleInputs').output.value[${ordinal}].expectedRowCount)`,
          );
        }
        const counts = expr("@json(concat('{'," + pieces.join(",") + ",'}'))");
        activities.push({
          ...invoke(
            target,
            {
              tables: members.map((node) => `${node.flow}/${node.table}`),
              expectedCounts: counts,
            },
            index,
          ),
          dependsOn: after(dependency),
        });
      }
    } else {
      const cases = entry.nodes.map((node, index) => {
        const target = primary(plan, node),
          declared =
            assets[`pipelines/${target}.json`].value.properties.parameters ??
            {};
        const parameters = {};
        for (const key of Object.keys(declared)) {
          check(
            [
              "expectedRowCount",
              "deliveryId",
              "version",
              "capturedAt",
              "initialiseIndex",
            ].includes(key),
            "No reviewed schedule input binding for pipeline parameter " + key,
          );
          check(
            entry.inputs,
            "A schedule input manifest is required for pipeline parameters",
          );
          parameters[key] = expr(
            ["version", "expectedRowCount"].includes(key)
              ? `@int(item().${key})`
              : `@item().${key}`,
          );
        }
        return {
          value: `${node.flow}/${node.table}`,
          activities: [invoke(target, parameters, index)],
        };
      });
      const switches = [];
      for (let index = 0; index < cases.length; index += 25)
        switches.push({
          name: "SelectTable" + index,
          type: "Switch",
          typeProperties: {
            on: expr("@item().tableId"),
            cases: cases.slice(index, index + 25),
            defaultActivities: [],
          },
        });
      const items = entry.inputs
        ? "@activity('ScheduleInputs').output.value"
        : "@json('" +
          JSON.stringify(
            entry.nodes.map((node) => ({
              tableId: `${node.flow}/${node.table}`,
            })),
          ) +
          "')";
      activities.push({
        name: "RunReviewedTables",
        type: "ForEach",
        dependsOn: after(dependency),
        typeProperties: {
          items: expr(items),
          isSequential: false,
          batchCount: 20,
          activities: switches,
        },
      });
    }
    add(
      "pipelines",
      dispatch,
      {
        concurrency: 1,
        parameters: { scheduledTime: { type: "String" } },
        activities,
      },
      entry.inputs ? [dataset] : [],
      targets,
    );
    const triggers = [];
    for (const [index, recurrence] of entry.recurrences.entries()) {
      const name = prefix + "_" + String(index + 1).padStart(3, "0");
      check(resource(name), "ADF trigger name exceeds its native limit");
      check(!assets[`triggers/${name}.json`], "ADF trigger resource collision");
      const properties = {
        type: "ScheduleTrigger",
        typeProperties: { recurrence },
        pipelines: [
          {
            pipelineReference: ref(dispatch),
            parameters: { scheduledTime: "@trigger().scheduledTime" },
          },
        ],
      };
      add("triggers", name, properties, [], [dispatch]);
      triggers.push({ name, file: `triggers/${name}.json`, properties });
    }
    manifests.push({
      flow: entry.flow,
      definition: entry.definition,
      boundaries: entry.boundaries,
      inputSource: entry.inputs ?? null,
      tables: entry.nodes.map((node) => `${node.flow}/${node.table}`),
      targets,
      dispatch: {
        name: dispatch,
        file: `pipelines/${dispatch}.json`,
        properties: assets[`pipelines/${dispatch}.json`].value.properties,
      },
      triggers,
      status: "not-created",
      activationIntent: entry.definition.enabled ? "Started" : "Stopped",
    });
  }
  assets["adf-schedules.json"] = {
    format: "json",
    value: {
      apiVersion: "ingestron.adf-schedules/v1",
      project: plan.project,
      planDigest: plan.digest,
      execution: "not-run",
      clock: "native-unqualified",
      schedules: manifests,
    },
  };
  assets["SCHEDULES.md"] = {
    format: "text",
    value:
      "# Reviewed ADF schedules\n\nReview adf-schedules.json, each trigger, the UTC dispatch guard and any source-owner manifest view. Generation makes no API call. New triggers require separately authorised activation; an existing trigger may already be running and must be reconciled separately. Native clock, overlap and missed-run behaviour are explicitly delegated and unqualified. Invalid inputs fail before dispatch; source extracts and manifest views must remain frozen together. Never trigger recovery or metadata worker pipelines directly. Generated UTC bounds are enforced against the scheduled occurrence, including an exclusive end. No cancellation or scheduled-execution qualification is claimed.\n",
  };
}
