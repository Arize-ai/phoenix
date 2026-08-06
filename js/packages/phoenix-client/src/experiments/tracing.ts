import {
  ENV_PHOENIX_COLLECTOR_ENDPOINT,
  getStrFromEnvironment,
} from "@arizeai/phoenix-config";
import type {
  GlobalTracerProviderRegistration,
  NodeTracerProvider,
} from "@arizeai/phoenix-otel";

/**
 * Message for the invariant shared by every experiment entry point: a base URL
 * must be resolvable before a tracer can be registered.
 */
export const MISSING_BASE_URL_MESSAGE =
  "Phoenix base URL not found. Please set PHOENIX_ENDPOINT (or PHOENIX_COLLECTOR_ENDPOINT) or set baseUrl on the client.";

/**
 * Resolves the URL experiment spans are exported to. A
 * `PHOENIX_COLLECTOR_ENDPOINT` set in the environment (process env or a
 * discovered `.env.phoenix`) wins — trace ingest can live at a different URL
 * than the API — otherwise export assumes the same server as the client's API
 * base URL.
 */
export function getTraceExportUrl(baseUrl: string): string {
  return getStrFromEnvironment(ENV_PHOENIX_COLLECTOR_ENDPOINT) || baseUrl;
}

/**
 * Flushes and shuts down a tracer provider that this package created, then
 * detaches any global OTEL registration it owns so another provider can be mounted.
 */
export async function cleanupOwnedTracerProvider({
  provider,
  globalRegistration,
}: {
  provider: NodeTracerProvider | null | undefined;
  globalRegistration?: GlobalTracerProviderRegistration | null;
}): Promise<void> {
  if (!provider) {
    return;
  }

  try {
    await provider.forceFlush();
  } finally {
    try {
      await provider.shutdown();
    } finally {
      globalRegistration?.detach();
    }
  }
}
