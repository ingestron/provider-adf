/** ODCS v3.1 library quality rules as a native pre-copy check (PB-063 phase 4).
 *
 * SQL snapshot standards read a frozen extract, so one Lookup computes every rule
 * metric on the source before Copy; an IfCondition fails the pipeline for
 * error-severity rules. No Data Flow. Rule identities match @ingestron/core.
 * Only counts are read; no row values are returned.
 */
const METRICS = [
  "nullValues",
  "missingValues",
  "invalidValues",
  "duplicateValues",
  "rowCount",
];
const OPERATORS = [
  "mustBe",
  "mustNotBe",
  "mustBeGreaterThan",
  "mustBeGreaterOrEqualTo",
  "mustBeLessThan",
  "mustBeLessOrEqualTo",
  "mustBeBetween",
  "mustNotBeBetween",
];
const fail = (message) => {
  throw new Error(message);
};

function parse(rule, table, column) {
  if (
    !rule ||
    typeof rule !== "object" ||
    (rule.type ?? "library") !== "library"
  )
    return undefined;
  const where = table + (column ? "." + column : "");
  if (!METRICS.includes(rule.metric))
    fail(`${where}: unsupported library metric ${rule.metric}`);
  const present = OPERATORS.filter((o) => rule[o] !== undefined);
  if (present.length !== 1)
    fail(`${where}: a library rule needs exactly one comparison`);
  return {
    id: String(rule.id ?? `${where}.${rule.metric}`),
    table,
    ...(column ? { column } : {}),
    metric: rule.metric,
    operator: present[0],
    threshold: rule[present[0]],
    arguments: rule.arguments ?? {},
    unit: rule.unit ?? "rows",
    outcome: /^error$/i.test(String(rule.severity ?? "")) ? "fail" : "warn",
    source: "contract",
  };
}

/** Explicit rules plus key-implied rules, as core computes them. */
export function contractRules(contract) {
  const object = contract.schema?.[0] ?? {};
  const table = String(object.name ?? "table");
  const rules = [];
  const add = (r) => r && rules.push(r);
  for (const q of contract.quality ?? []) add(parse(q, "*"));
  for (const q of object.quality ?? []) add(parse(q, table));
  const keys = [];
  for (const p of object.properties ?? []) {
    for (const q of p.quality ?? []) add(parse(q, table, p.name));
    if (p.primaryKey === true) keys.push(p.name);
  }
  for (const column of keys)
    if (!rules.some((r) => r.column === column && r.metric === "nullValues"))
      rules.push({
        id: `${table}.${column}.key-not-null`,
        table,
        column,
        metric: "nullValues",
        operator: "mustBe",
        threshold: 0,
        arguments: {},
        unit: "rows",
        outcome: "fail",
        source: "primary-key",
      });
  if (
    keys.length &&
    !rules.some((r) => !r.column && r.metric === "duplicateValues")
  )
    rules.push({
      id: `${table}.key-unique`,
      table,
      metric: "duplicateValues",
      operator: "mustBe",
      threshold: 0,
      arguments: { properties: keys },
      unit: "rows",
      outcome: "fail",
      source: "primary-key",
    });
  return rules;
}

const quote = (name) => "[" + name.replaceAll("]", "]]") + "]";
const numeric = (type) =>
  /^(BIGINT|INT|INTEGER|SMALLINT|DOUBLE|FLOAT|DECIMAL)/.test(type);
/** Listed values that cannot take the column type never match a row. */
function literals(values, type) {
  return (Array.isArray(values) ? values : []).flatMap((v) =>
    type === "STRING" && typeof v === "string"
      ? [`N'${v.replaceAll("'", "''")}'`]
      : numeric(type) && typeof v === "number" && Number.isFinite(v)
        ? [String(v)]
        : type === "BOOLEAN" && typeof v === "boolean"
          ? [v ? "1" : "0"]
          : [],
  );
}

function measure(rule, column, properties, from) {
  const sum = (condition) =>
    `ISNULL(SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END), 0)`;
  if (rule.metric === "rowCount") return "COUNT_BIG(*)";
  if (rule.metric === "duplicateValues") {
    if (column) return `COUNT_BIG(${column}) - COUNT_BIG(DISTINCT ${column})`;
    return `COUNT_BIG(*) - (SELECT COUNT_BIG(*) FROM (SELECT DISTINCT ${properties.join(", ")} FROM ${from}) AS d)`;
  }
  const { name, type } = column;
  const c = quote(name);
  if (rule.metric === "nullValues") return sum(`${c} IS NULL`);
  if (rule.metric === "missingValues") {
    const missing = literals(rule.arguments.missingValues ?? [null, ""], type);
    return sum(
      missing.length
        ? `${c} IS NULL OR ${c} IN (${missing.join(", ")})`
        : `${c} IS NULL`,
    );
  }
  if (typeof rule.arguments.pattern === "string")
    fail(
      `${rule.id}: SQL Server has no portable regular expressions; use arguments.validValues or a Databricks standard`,
    );
  const valid = literals(rule.arguments.validValues, type);
  return sum(
    valid.length
      ? `${c} IS NOT NULL AND ${c} NOT IN (${valid.join(", ")})`
      : `${c} IS NOT NULL`,
  );
}

/** Rules resolved to physical columns at planning. Throws for forms T-SQL cannot check. */
export function qualityRules(contract, columns) {
  const object = contract.schema?.[0] ?? {};
  const physical = new Map(
    (object.properties ?? []).map((p) => [p.name, p.physicalName ?? p.name]),
  );
  const byName = new Map(columns.map((c) => [c.name, c]));
  const column = (rule, name) =>
    byName.get(physical.get(name) ?? name) ??
    fail(`${rule.id}: unknown contract column ${name}`);
  return contractRules(contract).map((rule) => {
    if (
      ["nullValues", "missingValues", "invalidValues"].includes(rule.metric) &&
      !rule.column
    )
      fail(`${rule.id}: ${rule.metric} needs a column`);
    if (
      rule.metric === "invalidValues" &&
      typeof rule.arguments.pattern === "string"
    )
      fail(
        `${rule.id}: SQL Server has no portable regular expressions; use arguments.validValues or a Databricks standard`,
      );
    const properties = (rule.arguments.properties ?? []).map(
      (p) => column(rule, p).name,
    );
    if (rule.metric === "duplicateValues" && !rule.column && !properties.length)
      fail(`${rule.id}: table duplicateValues needs arguments.properties`);
    passing(rule);
    return {
      id: rule.id,
      metric: rule.metric,
      ...(rule.column ? { column: column(rule, rule.column).name } : {}),
      ...(properties.length ? { properties } : {}),
      ...(rule.arguments.validValues !== undefined
        ? { validValues: rule.arguments.validValues }
        : {}),
      ...(rule.arguments.missingValues !== undefined
        ? { missingValues: rule.arguments.missingValues }
        : {}),
      operator: rule.operator,
      threshold: rule.threshold,
      unit: rule.unit,
      outcome: rule.outcome,
    };
  });
}

/** One aggregate query over the frozen source; aliases q0, q1… follow rule order. */
export function qualityQuery(rules, columns, schema, table) {
  const types = new Map(columns.map((c) => [c.name, c.type]));
  const from = `${quote(schema)}.${quote(table)}`;
  const selected = rules.map((rule, i) => {
    const target = rule.column
      ? { name: rule.column, type: types.get(rule.column) }
      : undefined;
    let value = measure(
      {
        ...rule,
        arguments: {
          validValues: rule.validValues,
          missingValues: rule.missingValues,
        },
      },
      rule.metric === "duplicateValues" && target ? quote(target.name) : target,
      (rule.properties ?? []).map(quote),
      from,
    );
    if (rule.unit === "percent" && rule.metric !== "rowCount")
      value = `ISNULL(CAST(100.0 * (${value}) / NULLIF(COUNT_BIG(*), 0) AS DECIMAL(9, 4)), 0)`;
    return `${value} AS q${i}`;
  });
  return `SELECT ${selected.join(", ")} FROM ${from}`;
}

const passing = (c, value = "x") => {
  const t = c.threshold;
  if (c.operator === "mustBeBetween" || c.operator === "mustNotBeBetween") {
    if (!Array.isArray(t) || t.length !== 2 || !t.every(Number.isFinite))
      fail(`${c.id}: between comparisons need two numeric bounds`);
    const inside = `and(greaterOrEquals(${value}, ${t[0]}), lessOrEquals(${value}, ${t[1]}))`;
    return c.operator === "mustBeBetween" ? inside : `not(${inside})`;
  }
  if (!Number.isFinite(t))
    fail(`${c.id}: comparison needs a numeric threshold`);
  return {
    mustBe: `equals(${value}, ${t})`,
    mustNotBe: `not(equals(${value}, ${t}))`,
    mustBeGreaterThan: `greater(${value}, ${t})`,
    mustBeGreaterOrEqualTo: `greaterOrEquals(${value}, ${t})`,
    mustBeLessThan: `less(${value}, ${t})`,
    mustBeLessOrEqualTo: `lessOrEquals(${value}, ${t})`,
  }[c.operator];
};

/** ADF expression that is true when every error-severity rule passes. */
export function passingExpression(rules) {
  const conditions = rules.flatMap((c, i) =>
    c.outcome === "fail"
      ? [passing(c, `activity('CheckQuality').output.firstRow.q${i}`)]
      : [],
  );
  if (!conditions.length) return undefined;
  return conditions.length === 1
    ? `@${conditions[0]}`
    : `@and(${conditions.join(", ")})`;
}
