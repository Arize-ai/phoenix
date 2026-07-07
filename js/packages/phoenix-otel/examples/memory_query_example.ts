// Demonstrates tracing an agent memory recall with a `memory.query` span.
// Uses OpenInference CHAIN spans plus metadata attributes for hit/miss and latency.
//
// Run from js/ after building phoenix-otel:
//   pnpm --filter phoenix-otel build
//   npx tsx packages/phoenix-otel/examples/memory_query_example.ts

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

interface MemoryEntry {
  id: string;
  content: string;
}

interface MemoryQueryResult {
  hit: boolean;
  entries: MemoryEntry[];
  latencyMs: number;
}

/** In-memory store for the demo — replace with your vector DB or memory service. */
const DEMO_MEMORY: MemoryEntry[] = [
  { id: "mem-1", content: "User prefers dark mode in the UI." },
  { id: "mem-2", content: "User's timezone is America/Los_Angeles." },
];

async function main() {
  const provider = register({
    projectName: "memory-query-example",
    batch: false,
  });

  const queryMemory = withSpan(
    async (query: string, namespace: string): Promise<MemoryQueryResult> => {
      const start = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 30));

      const normalized = query.toLowerCase();
      const entries = DEMO_MEMORY.filter((entry) =>
        entry.content.toLowerCase().includes(normalized)
      );
      const hit = entries.length > 0;

      return {
        hit,
        entries,
        latencyMs: Math.round(performance.now() - start),
      };
    },
    {
      name: "memory.query",
      kind: OpenInferenceSpanKind.CHAIN,
      processInput: (query: string, namespace: string) => ({
        ...getInputAttributes(JSON.stringify({ query, namespace })),
        ...getMetadataAttributes({ operation: "memory.query", namespace }),
      }),
      processOutput: (result: MemoryQueryResult) => ({
        ...getOutputAttributes(JSON.stringify({ entries: result.entries })),
        ...getMetadataAttributes({
          "memory.hit": result.hit,
          "memory.latency_ms": result.latencyMs,
          "memory.result_count": result.entries.length,
        }),
      }),
    }
  );

  const result = await context.with(
    setSession(context.active(), { sessionId: "session-memory-001" }),
    () => queryMemory("dark mode preference", "user-facts")
  );

  console.log(
    `memory.query: hit=${result.hit}, results=${result.entries.length}, latency_ms=${result.latencyMs}`
  );

  await provider.shutdown();
}

main().catch(console.error);