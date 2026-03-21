import {
  createClient,
  type PhoenixClient,
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
