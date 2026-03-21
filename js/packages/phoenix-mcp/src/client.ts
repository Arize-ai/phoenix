import {
  createClient,
  type PhoenixClient,
  type Types,
} from "@arizeai/phoenix-client";

import type { PhoenixMcpConfig } from "./config.js";

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

export interface ResolveProjectIdOptions {
  client: PhoenixClient;
  projectIdentifier: string;
}

export interface ResolveDatasetIdOptions {
  client: PhoenixClient;
  datasetIdentifier: string;
}

export function looksLikePhoenixProjectId(projectIdentifier: string): boolean {
  const trimmedIdentifier = projectIdentifier.trim();
  if (!trimmedIdentifier) {
    return false;
  }
  return /^[0-9a-fA-F]+$/.test(trimmedIdentifier);
}

export function looksLikePhoenixDatasetId(datasetIdentifier: string): boolean {
  const trimmedIdentifier = datasetIdentifier.trim();
  if (!trimmedIdentifier) {
    return false;
  }
  return /^[0-9a-fA-F]+$/.test(trimmedIdentifier);
}

export async function resolveProjectId({
  client,
  projectIdentifier,
}: ResolveProjectIdOptions): Promise<string> {
  if (looksLikePhoenixProjectId(projectIdentifier)) {
    return projectIdentifier;
  }

  const response = await client.GET("/v1/projects/{project_identifier}", {
    params: {
      path: {
        project_identifier: projectIdentifier,
      },
    },
  });

  const data = getResponseData({
    response,
    errorPrefix: `Failed to resolve project "${projectIdentifier}"`,
  });

  return data.data.id;
}

export async function resolveDatasetId({
  client,
  datasetIdentifier,
}: ResolveDatasetIdOptions): Promise<string> {
  if (looksLikePhoenixDatasetId(datasetIdentifier)) {
    return datasetIdentifier;
  }

  const response = await client.GET("/v1/datasets", {
    params: {
      query: {
        name: datasetIdentifier,
        limit: 1,
      },
    },
  });

  const data = getResponseData({
    response,
    errorPrefix: `Failed to resolve dataset "${datasetIdentifier}"`,
  });

  if (data.data.length === 0) {
    throw new Error(`Dataset not found: "${datasetIdentifier}"`);
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
