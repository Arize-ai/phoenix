import type { componentsV1 } from "@arizeai/phoenix-client";

import type { OutputFormat } from "./formatDataset";
import { formatTable } from "./formatTable";

export type DatasetVersion = componentsV1["schemas"]["DatasetVersion"];

export interface FormatDatasetVersionsOutputOptions {
  /** Dataset versions to format, in server order. */
  datasetVersions: DatasetVersion[];
  /** Output format. Defaults to `"pretty"`. */
  format?: OutputFormat;
}

export function formatDatasetVersionsOutput({
  datasetVersions,
  format = "pretty",
}: FormatDatasetVersionsOutputOptions): string {
  if (format === "raw") {
    return JSON.stringify(datasetVersions);
  }
  if (format === "json") {
    return JSON.stringify(datasetVersions, null, 2);
  }
  if (datasetVersions.length === 0) {
    return "No dataset versions found";
  }
  return formatTable(
    datasetVersions.map((datasetVersion) => ({
      version_id: datasetVersion.version_id,
      description: datasetVersion.description ?? "",
      created_at: new Date(datasetVersion.created_at).toLocaleString(),
    }))
  );
}
