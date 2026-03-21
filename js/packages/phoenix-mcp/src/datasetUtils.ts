import type { PhoenixClient } from "@arizeai/phoenix-client";

import {
  getRelayGlobalIdIfType,
  requireIdentifier,
} from "./identifiers.js";
import { getResponseData } from "./responseUtils.js";

export interface ResolveDatasetIdOptions {
  client: PhoenixClient;
  datasetIdentifier: string;
}

export function isPhoenixDatasetId(datasetIdentifier: string): boolean {
  return (
    getRelayGlobalIdIfType({
      identifier: datasetIdentifier,
      expectedTypeName: "Dataset",
    }) !== null
  );
}

export async function resolveDatasetId({
  client,
  datasetIdentifier,
}: ResolveDatasetIdOptions): Promise<string> {
  const normalizedDatasetIdentifier = requireIdentifier({
    identifier: datasetIdentifier,
    label: "datasetIdentifier",
  });
  const datasetId = getRelayGlobalIdIfType({
    identifier: normalizedDatasetIdentifier,
    expectedTypeName: "Dataset",
  });

  if (datasetId) {
    return datasetId;
  }

  const response = await client.GET("/v1/datasets", {
    params: {
      query: {
        name: normalizedDatasetIdentifier,
        limit: 1,
      },
    },
  });

  const data = getResponseData({
    response,
    errorPrefix: `Failed to resolve dataset "${normalizedDatasetIdentifier}"`,
  });

  if (data.data.length === 0) {
    throw new Error(`Dataset not found: "${normalizedDatasetIdentifier}"`);
  }

  return data.data[0]!.id;
}
