import type { AdapterMetadata } from "@phoenix/agent/context/pageContextTypes";

export function createManifestFile({
  metadata,
  manifestFragment,
}: {
  metadata: AdapterMetadata;
  manifestFragment?: string;
}) {
  const sections = [
    "# Phoenix Agent Filesystem",
    "",
    `Generated: ${metadata.generatedAt}`,
    `Refresh reason: ${metadata.refreshReason}`,
    `Page kind: ${metadata.pageKind}`,
    `Pathname: ${metadata.pathname}${metadata.search}`,
    metadata.projectId ? `Project: ${metadata.projectId}` : null,
    metadata.traceId ? `Trace: ${metadata.traceId}` : null,
    metadata.timeRange
      ? `Time range: ${metadata.timeRange.start ?? "open"} -> ${metadata.timeRange.end ?? "open"}`
      : null,
    "",
    "## Files",
    ...metadata.files.map((filePath) => `- ${filePath}`),
    "",
    "## Suggested commands",
    "- ls /phoenix",
    "- cat /phoenix/_meta/context.json",
    "- find /phoenix -maxdepth 4 -type f",
    manifestFragment ? `\n${manifestFragment}` : null,
  ].filter((section): section is string => section !== null);

  return sections.join("\n");
}
