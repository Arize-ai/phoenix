export type OutputFormat = "pretty" | "json" | "raw";

export interface TraceTransferResult {
  transferred_trace_count: number;
  destination_project_identifier: string;
  destination_project_id: string;
}

export interface FormatTraceTransferOutputOptions {
  result: TraceTransferResult;
  format?: OutputFormat;
}

/**
 * Format the structured success record returned by `px trace transfer`.
 *
 * The record echoes the destination as the caller gave it (name or GlobalID)
 * alongside the GlobalID the server resolved it to.
 */
export function formatTraceTransferOutput({
  result,
  format,
}: FormatTraceTransferOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(result);
  }
  if (selected === "json") {
    return JSON.stringify(result, null, 2);
  }
  const count = result.transferred_trace_count;
  const noun = count === 1 ? "trace" : "traces";
  const destination =
    result.destination_project_identifier === result.destination_project_id
      ? result.destination_project_id
      : `${result.destination_project_identifier} (${result.destination_project_id})`;
  return `Transferred ${count} ${noun} to project ${destination}.`;
}
