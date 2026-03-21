import { createClient, type PhoenixClient } from "@arizeai/phoenix-client";

import type { PhoenixMcpConfig } from "./config.js";

export interface CreatePhoenixClientOptions {
  config: PhoenixMcpConfig;
}

/**
 * Create a Phoenix REST client for MCP tool handlers.
 *
 * The MCP package sends both bearer and `api_key` auth headers because Phoenix
 * deployments may rely on either convention.
 */
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
