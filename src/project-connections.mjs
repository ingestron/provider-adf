import { connectorPrepare } from "./connectors.mjs";
import {
  validateProjectConnection,
  selectionSchema,
  runtimeContract,
} from "./vendor/connectors/connection-contract.mjs";
import { object, text } from "./vendor/connectors/shape.mjs";
export {
  projectConnectionDefinition,
  selectionFromTables,
} from "./vendor/connectors/connection-contract.mjs";
const executionSchema = {
  ...object({
    mode: { type: "string", enum: ["adf-batch"] },
    azure: object({
      storageAccount: text,
      container: text,
      prefix: text,
      vaultUrl: text,
      identityClientId: text,
    }),
    compute: { type: "object", additionalProperties: true },
  }),
};
export const connectorRuntimes = {
  [runtimeContract]: {
    selectionSchema,
    executionSchema,
    prepareCommand: "connection prepare",
    contractsCommand: "connector contracts",
    executionPlatforms: ["adf"],
  },
};
export function projectConnectionPrepare(request) {
  const { runtimeAssets, ...input } = request;
  if (!runtimeAssets || !input.runtimeAssetSha256)
    throw Error("Install a connector package with runtime assets");
  const selection = validateProjectConnection(input, {
    ...connectorRuntimes[runtimeContract],
    settingsSchema: JSON.parse(runtimeAssets["settings.schema.json"]),
  });
  const result = connectorPrepare(
    {
      connector: input.connector.split(":")[1],
      mode: "customer-operated",
      sourceId: input.sourceId,
      tenantId: input.tenantId,
      configEnv: "INGESTRON_TAP_CONFIG",
      timeoutSeconds: input.timeoutSeconds,
      azure: {
        ...input.execution.azure,
        configSecret: "project-field-secrets",
      },
      compute: input.execution.compute,
    },
    ["selection.json", "project-connection.lock.json"],
    runtimeAssets,
  );
  const config = JSON.parse(result.artifacts["connector.json"]);
  config.sourceSettings = input.settings;
  config.projectLock = input;
  if (config.azure) delete config.azure.configSecret;
  result.artifacts["connector.json"] = JSON.stringify(config, null, 2);
  result.artifacts["selection.json"] = JSON.stringify(selection, null, 2);
  result.artifacts["project-connection.lock.json"] = JSON.stringify(
    input,
    null,
    2,
  );
  return result;
}
