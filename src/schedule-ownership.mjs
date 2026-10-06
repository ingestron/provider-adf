const check = (value, message) => {
  if (!value) throw Error(message);
};
const canonical = (value) => JSON.stringify(sort(value));
const sort = (value) =>
  Array.isArray(value)
    ? value.map(sort)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, sort(value[key])]),
        )
      : value;
const same = (a, b, message) => check(canonical(a) === canonical(b), message);
const window = (definition) =>
  "@" +
  (definition.end
    ? `and(greaterOrEquals(ticks(pipeline().parameters.scheduledTime),ticks('${definition.start}')),less(ticks(pipeline().parameters.scheduledTime),ticks('${definition.end}')))`
    : `greaterOrEquals(ticks(pipeline().parameters.scheduledTime),ticks('${definition.start}'))`);
export function verifyAdfScheduleOwnership(files, template, input) {
  const triggerFiles = Object.keys(files).filter(
    (name) => name.startsWith("triggers/") && name.endsWith(".json"),
  );
  const armTriggers = template.resources.filter(
    (resource) => resource.type === "Microsoft.DataFactory/factories/triggers",
  );
  if (!files["adf-schedules.json"]) {
    check(
      !triggerFiles.length && !armTriggers.length,
      "ADF triggers need an owned schedule manifest",
    );
    return;
  }
  const manifest = JSON.parse(files["adf-schedules.json"]);
  check(
    manifest.apiVersion === "ingestron.adf-schedules/v1" &&
      manifest.project === input.project &&
      manifest.execution === "not-run" &&
      manifest.clock === "native-unqualified" &&
      /^[a-f0-9]{64}$/.test(manifest.planDigest ?? "") &&
      Array.isArray(manifest.schedules) &&
      manifest.schedules.length,
    "Invalid ADF schedule ownership manifest",
  );
  const seen = new Set(),
    flows = new Set();
  const native = (kind, name) => {
    const file = `${kind}/${name}.json`;
    check(
      typeof files[file] === "string",
      "Missing owned ADF resource " + file,
    );
    const value = JSON.parse(files[file]);
    check(value.name === name, "Moved ADF resource " + file);
    const arm = template.resources.filter(
      (resource) =>
        resource.type === `Microsoft.DataFactory/factories/${kind}` &&
        resource.name === `[concat(parameters('factoryName'), '/${name}')]`,
    );
    check(
      arm.length === 1,
      "Missing or duplicate ARM schedule resource " + name,
    );
    same(
      arm[0].properties,
      value.properties,
      "ARM resource differs from its owned native file: " + name,
    );
    return { properties: value.properties, arm: arm[0] };
  };
  for (const entry of manifest.schedules) {
    check(
      !flows.has(entry.flow) && input.scope.flows.includes(entry.flow),
      "Schedule claims a foreign or repeated flow",
    );
    flows.add(entry.flow);
    check(
      entry.status === "not-created" &&
        entry.activationIntent ===
          (entry.definition.enabled ? "Started" : "Stopped"),
      "ADF activation intent was altered",
    );
    check(
      entry.boundaries?.start?.instant === entry.definition.start &&
        entry.boundaries?.end?.instant === entry.definition.end,
      "Schedule boundary ownership mismatch",
    );
    check(
      Array.isArray(entry.tables) &&
        entry.tables.length > 0 &&
        new Set(entry.tables).size === entry.tables.length &&
        entry.tables.every(
          (id) => id.startsWith(entry.flow + "/") && id.split("/").length === 2,
        ),
      "Schedule table ownership mismatch",
    );
    const name = `${input.project}_${entry.flow}_schedule_dispatch`;
    check(
      entry.dispatch.name === name &&
        entry.dispatch.file === `pipelines/${name}.json`,
      "Foreign schedule dispatcher",
    );
    const dispatch = native("pipelines", name);
    same(
      dispatch.properties,
      entry.dispatch.properties,
      "Dispatcher differs from reviewed schedule manifest",
    );
    const guard = dispatch.properties.activities?.[0];
    check(
      guard?.name === "CheckScheduleWindow" &&
        guard.type === "IfCondition" &&
        guard.typeProperties.expression.value === window(entry.definition) &&
        guard.typeProperties.ifFalseActivities.length === 1 &&
        guard.typeProperties.ifFalseActivities[0].type === "Fail",
      "Schedule UTC boundary guard changed",
    );
    const references = [];
    const walk = (activities, selector) => {
      for (const activity of activities ?? []) {
        if (activity.type === "ExecutePipeline")
          references.push({
            name: activity.typeProperties.pipeline.referenceName,
            parameters: activity.typeProperties.parameters,
            selector,
          });
        const properties = activity.typeProperties ?? {};
        walk(properties.activities, selector);
        walk(properties.ifTrueActivities, selector);
        walk(properties.ifFalseActivities, selector);
        walk(properties.defaultActivities, selector);
        for (const branch of properties.cases ?? [])
          walk(branch.activities, branch.value);
      }
    };
    walk(dispatch.properties.activities);
    same(
      [...new Set(references.map((reference) => reference.name))].sort(),
      [...entry.targets].sort(),
      "Schedule targets differ from dispatch references",
    );
    const covered = [];
    for (const reference of references) {
      const pipeline = native("pipelines", reference.name).properties;
      if (
        reference.name.startsWith(input.project + "_md_") &&
        reference.name.endsWith("_run")
      ) {
        check(
          pipeline.parameters?.tables?.type === "Array" &&
            pipeline.parameters?.expectedCounts?.type === "Object" &&
            Array.isArray(reference.parameters?.tables),
          "Schedule cannot directly invoke a metadata worker",
        );
        const catalogue = JSON.parse(pipeline.variables.catalogue.defaultValue);
        for (const id of reference.parameters.tables) {
          check(
            entry.tables.includes(id) && catalogue[id],
            "Metadata schedule invokes a foreign table",
          );
          covered.push(id);
        }
      } else {
        check(
          entry.tables.includes(reference.selector) &&
            reference.name ===
              input.project + "_" + reference.selector.replace("/", "_"),
          "Schedule invokes an unowned table or recovery pipeline",
        );
        check(
          pipeline.activities.some(
            (activity) =>
              activity.type === "Copy" || activity.name === "ReadWatermark",
          ),
          "Schedule target is not a primary ingestion pipeline",
        );
        covered.push(reference.selector);
      }
    }
    same(
      covered.sort(),
      [...entry.tables].sort(),
      "Schedule must dispatch each owned table exactly once",
    );
    same(
      dispatch.arm.dependsOn
        .filter((value) => value.includes("factories/pipelines"))
        .sort(),
      entry.targets
        .map(
          (target) =>
            `[resourceId('Microsoft.DataFactory/factories/pipelines', parameters('factoryName'), '${target}')]`,
        )
        .sort(),
      "Schedule primary pipeline dependencies changed",
    );
    check(
      Array.isArray(entry.triggers) && entry.triggers.length > 0,
      "Missing owned schedule triggers",
    );
    for (const trigger of entry.triggers) {
      check(
        !seen.has(trigger.file) &&
          trigger.file === `triggers/${trigger.name}.json` &&
          trigger.name.startsWith(`${input.project}_${entry.flow}_schedule_`),
        "Foreign or repeated trigger file",
      );
      seen.add(trigger.file);
      const actual = native("triggers", trigger.name);
      same(
        actual.properties,
        trigger.properties,
        "Trigger differs from reviewed schedule manifest",
      );
      check(
        Object.keys(actual.properties).every((key) =>
          ["type", "typeProperties", "pipelines"].includes(key),
        ) && actual.properties.type === "ScheduleTrigger",
        "Unsupported trigger activation fields",
      );
      same(
        actual.properties.pipelines,
        [
          {
            pipelineReference: {
              type: "PipelineReference",
              referenceName: name,
            },
            parameters: { scheduledTime: "@trigger().scheduledTime" },
          },
        ],
        "Trigger invokes a foreign pipeline or changes scheduled occurrence identity",
      );
      same(
        actual.arm.dependsOn,
        [
          `[resourceId('Microsoft.DataFactory/factories/pipelines', parameters('factoryName'), '${name}')]`,
        ],
        "Trigger dependency ownership changed",
      );
    }
  }
  same(
    [...seen].sort(),
    triggerFiles.sort(),
    "Unowned or missing native trigger files",
  );
  check(armTriggers.length === seen.size, "Unowned ARM schedule triggers");
}
