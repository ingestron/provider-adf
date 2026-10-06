export const scheduleInputsSchema = {
  type: "object",
  description:
    "Reviewed source-owner manifest views, keyed by scheduled flow. Read at each occurrence; no fixed counts or guessed delivery identities.",
  patternProperties: {
    "^[A-Za-z_][A-Za-z0-9_-]*$": {
      type: "object",
      required: ["kind", "linkedService", "schema", "view"],
      properties: {
        kind: { enum: ["azure-sql", "sql-server"] },
        linkedService: {
          type: "string",
          pattern: "^[A-Za-z_][A-Za-z0-9_-]{0,100}$",
        },
        schema: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_]{0,127}$" },
        view: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_]{0,127}$" },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};
