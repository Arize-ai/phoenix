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
   * Phoenix project IDs are base64-encoded "global IDs" (commonly something like `base64("Project:<id>")`).
   * If `projectIdentifier` decodes to a `Project:`-prefixed string, it's treated as an ID; otherwise it's treated as a name.
   */
  projectIdentifier: string;
}

function looksLikePhoenixProjectId(projectIdentifier: string): boolean {
  // Base64 "global id" heuristic:
  // - Accepts base64 and base64url
  // - Decodes to UTF-8
  // - Must be an ASCII-ish string starting with "Project:"
  const trimmed = projectIdentifier.trim();
  if (!trimmed) return false;

  // Quick allow-list to avoid Buffer.from decoding random strings.
  if (!/^[A-Za-z0-9+/=_-]+$/.test(trimmed)) return false;

  // Normalize base64url to base64.
  const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");

  let decoded: string;
  try {
    decoded = Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return false;
  }

  return decoded.startsWith("Project:") || decoded.startsWith("project:");
}

/**
 * Resolve project identifier to project ID
 * If the identifier looks like a Phoenix project ID (base64 global-id), returns it as-is; otherwise fetches by name.
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
