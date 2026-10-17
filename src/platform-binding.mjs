/** Translate reviewed references only. No Azure access or factory creation. */
const factoryPattern = "^[A-Za-z_][A-Za-z0-9_-]{0,100}$";
export const platformBinding = {
  apiVersion: "ingestron.platform-binding-authoring/v1",
  designResources: { factoryName: "design_factory" },
  resourcesSchema: {
    type: "object",
    additionalProperties: false,
    required: ["factoryName"],
    properties: {
      factoryName: {
        type: "string",
        pattern: factoryPattern,
        title: "Existing ADF factory name",
      },
    },
  },
};

export function bindPlatform({ profile, resources, projectId, environment }) {
  if (profile.authentication !== "azure-cli" || profile.secrets.length)
    throw Error(
      "This offline binding supports Azure CLI authentication without copied secret references; review other identity methods separately.",
    );
  if (profile.purpose === "production")
    throw Error(
      "Production needs reviewed run identity, permissions and operational settings before binding.",
    );
  if (
    Object.keys(resources).some((key) => key !== "factoryName") ||
    typeof resources.factoryName !== "string" ||
    !new RegExp(factoryPattern).test(resources.factoryName)
  )
    throw Error(
      "Choose an existing factory name. This generation binding accepts only factoryName; deployment scope and identity settings require separate support.",
    );
  if (
    ![projectId, environment].every(
      (value) =>
        typeof value === "string" &&
        /^[A-Za-z_][A-Za-z0-9_-]{0,79}$/.test(value),
    )
  )
    throw Error("Invalid project or environment identity.");
  return {
    apiVersion: "ingestron.provider-binding/v1",
    binding: { kind: "adf", factoryName: resources.factoryName },
    options: {},
    ownership:
      "The existing factory, linked services and integration runtimes remain externally owned. Generated pipelines and datasets are scoped by project, flow and table; binding creates or deploys no resources.",
    pendingIntent: [
      "Flow standards, naming and quality are reviewed when defining the deliverable; resource binding alone does not apply them.",
      "Subscription, resource group, connectivity, permissions and deployment authority require separate review before native execution.",
    ],
  };
}
