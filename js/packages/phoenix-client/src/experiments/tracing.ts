import type {
  GlobalTracerProviderRegistration,
  NodeTracerProvider,
} from "@arizeai/phoenix-otel";

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
