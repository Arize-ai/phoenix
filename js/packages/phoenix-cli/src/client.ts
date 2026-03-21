import { createClient, type PhoenixClient } from "@arizeai/phoenix-client";

import type { PhoenixConfig } from "./config";

export interface CreatePhoenixClientOptions {
  /**
   * Resolved Phoenix CLI configuration.
   */
  config: PhoenixConfig;
}

/**
 * Create a Phoenix client from configuration
 */
export function createPhoenixClient({
  config,
}: CreatePhoenixClientOptions): PhoenixClient {
  const baseUrl = config.endpoint;

  if (!baseUrl) {
    throw new Error("Phoenix endpoint not configured");
  }

  const headers: Record<string, string> = {
    ...(config.headers || {}),
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  return createClient({
    options: {
      baseUrl,
      headers,
    },
  });
}

export interface ResolveProjectIdOptions {
  /**
   * Phoenix API client.
   */
  client: PhoenixClient;
  /**
   * Project identifier to resolve.
   *
   * Phoenix project IDs are hex-encoded strings. If `projectIdentifier` looks like a hex string,
   * it's treated as an ID; otherwise it's treated as a name and resolved via the API.
   */
  projectIdentifier: string;
}

function looksLikePhoenixProjectId(projectIdentifier: string): boolean {
  // Project IDs are hex-encoded strings (e.g., "a1b2c3d4e5f6...")
  const trimmed = projectIdentifier.trim();
  if (!trimmed) return false;

  // Check if the string is a valid hex string (only 0-9, a-f, A-F)
  return /^[0-9a-fA-F]+$/.test(trimmed);
}

/**
 * Resolve project identifier to project ID
 * If the identifier looks like a Phoenix project ID (hex string), returns it as-is; otherwise fetches by name.
 */
export async function resolveProjectId({
  client,
  projectIdentifier,
}: ResolveProjectIdOptions): Promise<string> {
  if (looksLikePhoenixProjectId(projectIdentifier)) {
    return projectIdentifier;
  }

  // Otherwise, fetch the project by name to get its ID
  try {
    const response = await client.GET("/v1/projects/{project_identifier}", {
      params: {
        path: {
          project_identifier: projectIdentifier,
        },
      },
    });

    if (response.error || !response.data) {
      throw new Error(
        `Failed to resolve project "${projectIdentifier}": ${response.error}`
      );
    }

    return response.data.data.id;
  } catch (error) {
    throw new Error(
      `Failed to resolve project "${projectIdentifier}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export interface ResolveDatasetIdOptions {
  /**
   * Phoenix API client.
   */
  client: PhoenixClient;
  /**
   * Dataset identifier to resolve.
   *
   * Phoenix dataset IDs are hex-encoded strings. If `datasetIdentifier` looks like a hex string,
   * it's treated as an ID; otherwise it's treated as a name and resolved via the API.
   */
  datasetIdentifier: string;
}

function looksLikePhoenixDatasetId(datasetIdentifier: string): boolean {
  // Dataset IDs are hex-encoded strings (e.g., "a1b2c3d4e5f6...")
  const trimmed = datasetIdentifier.trim();
  if (!trimmed) return false;

  // Check if the string is a valid hex string (only 0-9, a-f, A-F)
  return /^[0-9a-fA-F]+$/.test(trimmed);
}

/**
 * Resolve dataset identifier to dataset ID
 * If the identifier looks like a Phoenix dataset ID (hex string), returns it as-is; otherwise fetches by name.
 */
export async function resolveDatasetId({
  client,
  datasetIdentifier,
}: ResolveDatasetIdOptions): Promise<string> {
  if (looksLikePhoenixDatasetId(datasetIdentifier)) {
    return datasetIdentifier;
  }

  // Otherwise, fetch the dataset by name to get its ID
  try {
    const response = await client.GET("/v1/datasets", {
      params: {
        query: {
          name: datasetIdentifier,
          limit: 1,
        },
      },
    });

    if (response.error || !response.data) {
      throw new Error(
        `Failed to resolve dataset "${datasetIdentifier}": ${response.error}`
      );
    }

    const datasets = response.data.data;
    if (datasets.length === 0) {
      throw new Error(`Dataset not found: "${datasetIdentifier}"`);
    }

    return datasets[0].id;
  } catch (error) {
    throw new Error(
      `Failed to resolve dataset "${datasetIdentifier}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
