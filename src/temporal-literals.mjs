/** Calendar-checked portable scalar values; no timezone or precision coercion. */
export function temporalLiteral(value, type, dialect) {
  if (typeof value !== "string") return undefined;
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    type === "DATE" ? value : value.slice(0, 10),
  );
  if (!date || date[0].length !== (type === "DATE" ? value.length : 10))
    return undefined;
  const year = Number(date[1]),
    month = Number(date[2]),
    day = Number(date[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    year < (dialect.name === "mysql" ? 1000 : 1) ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1]
  )
    return undefined;
  let canonical = value;
  if (type === "TIMESTAMP") {
    const clock =
      /^\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/.exec(
        value,
      );
    if (
      !clock ||
      clock[0].length !== value.length ||
      Number(clock[1]) > 23 ||
      Number(clock[2]) > 59 ||
      Number(clock[3]) > 59
    )
      return undefined;
    canonical = value.replace("T", " ");
  } else if (type !== "DATE") return undefined;
  if (dialect.name === "tsql")
    return type === "DATE"
      ? `CONVERT(date, '${canonical.replaceAll("-", "")}', 112)`
      : `CONVERT(datetime2(6), '${canonical.replace(" ", "T")}', 126)`;
  return `${type} '${canonical}'`;
}
