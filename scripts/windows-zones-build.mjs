/** Pinned Unicode CLDR data; no network or runtime clock. See src/vendor/unicode/UNICODE-LICENSE.txt. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
export function buildWindowsZones() {
  const data = new URL("../src/vendor/unicode/", import.meta.url);
  const provenance = JSON.parse(
    readFileSync(new URL("provenance.json", data), "utf8"),
  );
  for (const file of [
    "windowsZones.xml",
    "timezone.xml",
    "UNICODE-LICENSE.txt",
  ]) {
    const bytes = readFileSync(new URL(file, data));
    if (
      createHash("sha256").update(bytes).digest("hex") !==
      provenance[file]?.sha256
    )
      throw Error("Pinned Unicode data digest mismatch: " + file);
  }
  const zones = {};
  const add = (name, windows) => {
    const key = name.toLowerCase();
    if (zones[key] && zones[key] !== windows)
      throw Error("Ambiguous Unicode Windows mapping: " + name);
    zones[key] = windows;
  };
  const attributes = (tag) =>
    Object.fromEntries(
      [...tag.matchAll(/([A-Za-z]+)="([^"]*)"/g)].map((match) => [
        match[1],
        match[2],
      ]),
    );
  const map = readFileSync(new URL("windowsZones.xml", data), "utf8");
  const records = [...map.matchAll(/<mapZone\s+[^>]*\/>/g)].map((match) =>
    attributes(match[0]),
  );
  if (records.length < 500)
    throw Error("Incomplete pinned Windows time-zone data");
  for (const record of records)
    for (const name of record.type.split(" ")) add(name, record.other);
  const aliases = readFileSync(new URL("timezone.xml", data), "utf8");
  for (const match of aliases.matchAll(/<type\s+[^>]*\/>/g)) {
    const record = attributes(match[0]);
    const names = (record.alias ?? "").split(" ").filter(Boolean);
    const mapped = [
      ...new Set(
        names.map((name) => zones[name.toLowerCase()]).filter(Boolean),
      ),
    ];
    if (mapped.length > 1)
      throw Error("Ambiguous pinned IANA alias group: " + record.name);
    if (mapped.length === 1) for (const name of names) add(name, mapped[0]);
  }
  return Object.fromEntries(
    Object.entries(zones).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}
