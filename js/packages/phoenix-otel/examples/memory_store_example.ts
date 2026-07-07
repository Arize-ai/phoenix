// Demonstrates tracing an agent memory write with a `memory.store` span.
// Uses OpenInference CHAIN spans plus metadata for namespace and entry size.
//
// Run from js/ after building phoenix-otel:
//   pnpm --filter phoenix-otel build
//   npx tsx packages/phoenix-otel/examples/memory_store_example.ts

/* eslint-disable no-console */
import {
  OpenInferenceSpanKind,
  context,
  getInputAttributes,
  getMetadataAttributes,
  getOutputAttributes,
  register,
  setSession,
  withSpan,
} from "../src";

interface MemoryStoreInput {
  content: string;
  namespace: string;
  source: "user" | "agent" | "tool";
}

interface MemoryStoreResult {
  entryId: string;
  storedBytes: number;
  latencyMs: number;
}

async function main() {
  const provider = register({
    projectName: "memory-store-example",
    batch: false,
  });

  const storeMemory = withSpan(
    async (input: MemoryStoreInput): Promise<MemoryStoreResult> => {
      const start = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 25));

      const entryId = `mem-${Date.now()}`;
      const storedBytes = new TextEncoder().encode(input.content).length;

      return {
        entryId,
        storedBytes,
        latencyMs: Math.round(performance.now() - start),
      };
    },
    {
      name: "memory.store",
      kind: OpenInferenceSpanKind.CHAIN,
      processInput: (input: MemoryStoreInput) => ({
        ...getInputAttributes(
          JSON.stringify({
            content: input.content,
            namespace: input.namespace,
            source: input.source,
          })
        ),
        ...getMetadataAttributes({
          operation: "memory.store",
          namespace: input.namespace,
          source: input.source,
        }),
      }),
      processOutput: (result: MemoryStoreResult) => ({
        ...getOutputAttributes(JSON.stringify({ entry_id: result.entryId })),
        ...getMetadataAttributes({
          "memory.entry_id": result.entryId,
          "memory.stored_bytes": result.storedBytes,
          "memory.latency_ms": result.latencyMs,
        }),
      }),
    }
  );

  const result = await context.with(
    setSession(context.active(), { sessionId: "session-memory-001" }),
    () =>
      storeMemory({
        content: "User asked to be reminded about the Q3 roadmap review.",
        namespace: "user-facts",
        source: "user",
      })
  );

  console.log(
    `memory.store: entry_id=${result.entryId}, bytes=${result.storedBytes}, latency_ms=${result.latencyMs}`
  );

  await provider.shutdown();
}

main().catch(console.error);