import type { AdapterMetadata } from "@phoenix/agent/tools/bash/context/pageContextTypes";

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
    `Pathname: ${metadata.pathname}${metadata.search}`,
    Object.keys(metadata.params).length > 0
      ? `Route params: ${JSON.stringify(metadata.params)}`
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
