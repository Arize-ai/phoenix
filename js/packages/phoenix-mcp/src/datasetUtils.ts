import type { PhoenixClient } from "@arizeai/phoenix-client";

import { getRelayGlobalIdIfType, requireIdentifier } from "./identifiers.js";
import { getResponseData } from "./responseUtils.js";

/**
 * Determine whether a dataset identifier is already a Phoenix Relay GlobalID.
 */
export function isPhoenixDatasetId(identifier: string): boolean {
  return (
    getRelayGlobalIdIfType({
      identifier,
      expectedTypeName: "Dataset",
    }) !== null
  );
}

/**
 * Resolve a dataset name or Relay GlobalID to the dataset's canonical ID.
 *
 * When `datasetId` is provided and is a valid Relay GlobalID, it is returned
 * directly without an API call. Otherwise `datasetName` is looked up via the
 * datasets list endpoint.
 */
export async function resolveDatasetId({
  client,
  datasetId,
  datasetName,
}: {
  client: PhoenixClient;
  datasetId?: string;
  datasetName?: string;
}): Promise<string> {
  // Prefer datasetId when provided
  if (datasetId) {
    const normalizedId = requireIdentifier({
      identifier: datasetId,
      label: "datasetId",
    });
    const relayId = getRelayGlobalIdIfType({
      identifier: normalizedId,
      expectedTypeName: "Dataset",
    });
    if (relayId) {
      return relayId;
    }
    // datasetId might be a name if caller used the wrong field — fall through
  }

  const nameToResolve = datasetName || datasetId;
  if (!nameToResolve?.trim()) {
    throw new Error("datasetName or datasetId is required");
  }

  const normalizedName = requireIdentifier({
    identifier: nameToResolve,
    label: "datasetName",
  });

  const response = await client.GET("/v1/datasets", {
    params: {
      query: {
        name: normalizedName,
        limit: 1,
      },
    },
  });

  const data = getResponseData({
    response,
    errorPrefix: `Failed to resolve dataset "${normalizedName}"`,
  });

  if (data.data.length === 0) {
    throw new Error(`Dataset not found: "${normalizedName}"`);
  }

  return data.data[0]!.id;
}
