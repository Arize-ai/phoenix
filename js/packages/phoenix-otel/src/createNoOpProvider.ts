import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

/**
 * Creates a `NodeTracerProvider` with no span processors, meaning spans are
 * created but never exported. Useful for testing, dry runs, or environments
 * where tracing should be disabled without changing instrumented code.
 *
 * @returns A no-op tracer provider that silently discards all spans.
 */
export function createNoOpProvider() {
  const provider = new NodeTracerProvider({});

  return provider;
}
