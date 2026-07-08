import { LatencyText } from "@phoenix/components/trace/LatencyText";

export function ExperimentRunLatency({
  latencyMs,
}: {
  latencyMs: number | null;
}) {
  if (latencyMs === null) {
    return null;
  }
  return <LatencyText size="S" latencyMs={latencyMs} />;
}
