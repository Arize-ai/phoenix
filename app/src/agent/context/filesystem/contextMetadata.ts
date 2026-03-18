import type { AdapterMetadata } from "@phoenix/agent/context/pageContextTypes";

export function createContextMetadataFile(metadata: AdapterMetadata) {
  return JSON.stringify(metadata, null, 2);
}
