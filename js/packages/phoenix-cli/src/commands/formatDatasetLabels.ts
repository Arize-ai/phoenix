import type { DatasetLabel } from "@arizeai/phoenix-client/datasets";

import { formatTable } from "./formatTable";
import type { CommonOptions } from "./options";

/**
 * Format assigned labels, preserving the API's single-label or list shape.
 * @param options.labels - The label or label list returned by the server.
 * @param options.format - Output format, defaulting to a readable table.
 */
export function formatDatasetLabelsOutput({
  labels,
  format = "pretty",
}: {
  labels: DatasetLabel | DatasetLabel[];
  format?: CommonOptions["format"];
}): string {
  if (format === "raw") {
    return JSON.stringify(labels);
  }
  if (format === "json") {
    return JSON.stringify(labels, null, 2);
  }
  const assignedLabels = Array.isArray(labels) ? labels : [labels];
  if (assignedLabels.length === 0) {
    return "No dataset labels assigned";
  }
  return formatTable(
    assignedLabels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description ?? "",
    }))
  );
}
