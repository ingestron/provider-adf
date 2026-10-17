/** Exact-file design authoring. The connection's credentials stay in the connector. */
export function authorFileHandoff(o) {
  if (
    !/^[A-Za-z_][\w-]{0,65}$/.test(o.id) ||
    !o.tables?.length ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(o.container)
  )
    throw Error("Choose reviewed Azure Blob files and a container");
  const tables = {};
  for (const t of o.tables) {
    if (
      !/^[A-Za-z_][\w-]*$/.test(t.id) ||
      !["json", "csv"].includes(t.format) ||
      !t.path.endsWith("." + t.format) ||
      !t.path.split("/").every((p) => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(p))
    )
      throw Error(
        "Handoff supports exact JSON/CSV files without wildcards or traversal",
      );
    tables[t.id] = {
      source: {
        kind: "azure-blob",
        linkedService: "design_blob_source",
        container: o.container,
        path: t.path,
        format: t.format,
        completion: "immutable",
      },
      contract: t.contract,
    };
  }
  return {
    flow: {
      apiVersion: "ingestron.flow/v1",
      id: o.id,
      kind: "ingestion",
      provider: o.provider,
      description: `Design handoff from ${o.origin}; verify immutable files, linked services and completed-batch orchestration before deployment.`,
      ingestion: {
        standard: "immutable-file-copy@v1",
        target: {
          linkedService: "design_landing",
          fileSystem: "design-landing",
          path: o.id,
        },
        handover: { binding: o.binding },
      },
      tables,
    },
    bindings: { [o.binding]: { kind: "adls", accountName: "designlanding" } },
  };
}
