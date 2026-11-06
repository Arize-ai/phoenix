import type {
  GlobalTracerProviderRegistration,
  NodeTracerProvider,
} from "@arizeai/phoenix-otel";

import type { BaseUrlSource } from "../config";

/**
 * Message for the invariant shared by every experiment entry point: a base URL
 * must be resolvable before a tracer can be registered.
 */
export const MISSING_BASE_URL_MESSAGE =
  "Phoenix base URL not found. Please set PHOENIX_ENDPOINT (or PHOENIX_COLLECTOR_ENDPOINT) or set baseUrl on the client.";

/**
 * Resolves the URL experiment spans are exported to, as the `url` argument to
 * `register()`.
 *
 * Explicit code-level configuration outranks the ambient environment: a client
 * created with an explicit `baseUrl` exports its spans to that server, so a
 * `PHOENIX_COLLECTOR_ENDPOINT` left in the shell cannot silently retarget it.
 * When the base URL itself came from the environment, so does trace export:
 * returning `undefined` hands resolution to `register()`, which reads the
 * trace-export chain (`PHOENIX_COLLECTOR_ENDPOINT`, the OTel-standard
 * variables, then `PHOENIX_ENDPOINT`) exactly as a standalone `register()`
 * call would.
 *
 * A base URL of unknown provenance — a hand-built client rather than one from
 * `createClient()` — counts as explicit, since only deliberate configuration
 * puts a URL there.
 */
export function getTraceExportUrl(config: {
  baseUrl?: string;
  baseUrlSource?: BaseUrlSource;
}): string | undefined {
  return (config.baseUrlSource ?? "explicit") === "explicit"
    ? config.baseUrl
    : undefined;
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
