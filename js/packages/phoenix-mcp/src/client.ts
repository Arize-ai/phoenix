import {
  createClient,
  type PhoenixClient,
  type Types,
} from "@arizeai/phoenix-client";

import type { PhoenixMcpConfig } from "./config.js";
import {
  getRelayGlobalIdIfType,
  requireIdentifier,
} from "./identifiers.js";

export interface CreatePhoenixClientOptions {
  config: PhoenixMcpConfig;
}

export function createPhoenixClient({
  config,
}: CreatePhoenixClientOptions): PhoenixClient {
  const headers: Record<string, string> = {
    ...(config.headers || {}),
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
    headers.api_key = config.apiKey;
  }

  return createClient({
    options: {
      baseUrl: config.baseUrl,
      headers,
    },
  });
}

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

type PhoenixResponse<TData> = {
  data?: TData;
  error?: unknown;
};

export function getResponseData<TData>({
  response,
  errorPrefix,
}: {
  response: PhoenixResponse<TData>;
  errorPrefix: string;
}): TData {
  if (response.error || response.data === undefined) {
    throw new Error(
      `${errorPrefix}: ${response.error instanceof Error ? response.error.message : String(response.error || "Unknown error")}`
    );
  }

  return response.data;
}

export type ProjectSpansQuery = NonNullable<
  Types["V1"]["operations"]["getSpans"]["parameters"]["query"]
>;
