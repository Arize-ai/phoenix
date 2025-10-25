import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

/**
 * For dry runs we create a provider that doesn't export traces.
 */
export function createNoOpProvider() {
  const provider = new NodeTracerProvider({});

  return provider;
}
