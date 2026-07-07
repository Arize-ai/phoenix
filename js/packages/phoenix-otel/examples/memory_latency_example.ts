// Demonstrates recording memory operation latency in span metadata.
// Compares `memory.query` hit vs miss paths and surfaces latency_ms for dashboards.
//
// Run from js/ after building phoenix-otel:
//   pnpm --filter phoenix-otel build
//   npx tsx packages/phoenix-otel/examples/memory_latency_example.ts

/* eslint-disable no-console */
import {
  OpenInferenceSpanKind,
  getMetadataAttributes,
  register,
  withSpan,
} from "../src";

interface LatencyProbe {
  label: string;
  hit: boolean;
  latencyMs: number;
}

async function main() {
  const provider = register({
    projectName: "memory-latency-example",
    batch: false,
  });

  const probeMemory = withSpan(
    async (label: string, simulateHit: boolean): Promise<LatencyProbe> => {
      const start = performance.now();
      // Miss paths often scan more entries; simulate with a longer delay.
      const delayMs = simulateHit ? 18 : 55;
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      return {
        label,
        hit: simulateHit,
        latencyMs: Math.round(performance.now() - start),
      };
    },
    {
      name: "memory.query",
      kind: OpenInferenceSpanKind.CHAIN,
      processOutput: (result: LatencyProbe) =>
        getMetadataAttributes({
          operation: "memory.query",
          "memory.hit": result.hit,
          "memory.latency_ms": result.latencyMs,
          "memory.probe": result.label,
        }),
    }
  );

  const hit = await probeMemory("preference-lookup", true);
  const miss = await probeMemory("unknown-topic-lookup", false);

  console.log(`hit path:  latency_ms=${hit.latencyMs}`);
  console.log(`miss path: latency_ms=${miss.latencyMs}`);

  await provider.shutdown();
}

main().catch(console.error);