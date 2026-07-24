import type { TooltipContentProps } from "recharts";

import { ChartTooltip, ChartTooltipItem } from "@phoenix/components/chart";

import { ExperimentMetricsTooltipHeader } from "./ExperimentMetricsTooltipHeader";

type ValueFormatter = (value: number | null | undefined) => string;

/**
 * Safely extracts the experiment fields from a recharts tooltip payload datum.
 */
function parseExperimentDatum(value: unknown): {
  experimentName?: string;
  isBaseline?: boolean;
} {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const datum: { experimentName?: string; isBaseline?: boolean } = {};
  if ("experimentName" in value && typeof value.experimentName === "string") {
    datum.experimentName = value.experimentName;
  }
  if ("isBaseline" in value && typeof value.isBaseline === "boolean") {
    datum.isBaseline = value.isBaseline;
  }
  return datum;
}

/**
 * Builds the tooltip content for an experiment metric chart: the shared
 * experiment header followed by one row per series. Each row's swatch comes
 * from the series' own payload entry so it always matches the rendered mark,
 * and missing values reach the formatter as null (rendered "--") instead of
 * being coerced to a fake zero.
 */
export function makeExperimentMetricsTooltipContent(
  valueFormatter: ValueFormatter
) {
  return function ExperimentMetricsTooltipContent({
    active,
    payload,
    label,
  }: TooltipContentProps) {
    if (!active || !payload || payload.length === 0) {
      return null;
    }
    const datum = parseExperimentDatum(payload[0]?.payload);
    return (
      <ChartTooltip>
        <ExperimentMetricsTooltipHeader
          sequenceNumber={Number(label)}
          name={datum?.experimentName}
          isBaseline={datum?.isBaseline}
        />
        {payload.map((entry) => {
          const name = String(entry.name ?? entry.dataKey ?? "unknown");
          return (
            <ChartTooltipItem
              color={entry.color ?? "transparent"}
              key={name}
              shape="circle"
              name={name}
              value={valueFormatter(
                typeof entry.value === "number" ? entry.value : null
              )}
            />
          );
        })}
      </ChartTooltip>
    );
  };
}
