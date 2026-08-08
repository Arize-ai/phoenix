/**
 * The Phoenix API capability: a factory for typed clients, so steps never
 * construct one from ambient config. Tests inject a fake transport beneath
 * the same real client.
 */

import type { PhoenixClient } from "@arizeai/phoenix-client";

import { createPhoenixClient } from "../../client";

export interface PhoenixClientArgs {
  /** Normalized origin, no trailing slash. */
  endpoint: string;
  /** Omitted for the unauthenticated auth probe. */
  apiKey?: string;
}

export type PhoenixClientFactory = (args: PhoenixClientArgs) => PhoenixClient;

/**
 * `apiUrl` is the hidden `--api-url` dev override: it reroutes setup's own
 * API traffic while user-facing values — hand-off files, px profile, traces
 * URLs — keep the endpoint the user chose.
 */
export function createPhoenixClientFactory({
  apiUrl,
}: {
  apiUrl?: string;
} = {}): PhoenixClientFactory {
  return ({ endpoint, apiKey }) =>
    createPhoenixClient({
      config: { endpoint: apiUrl ?? endpoint, apiKey },
    });
}
