import type { TooltipContentProps } from "recharts";

import { ChartTooltip, ChartTooltipItem } from "@phoenix/components/chart";

import { ExperimentMetricsTooltipHeader } from "./ExperimentMetricsTooltipHeader";

type ValueFormatter = (value: number | null | undefined) => string;

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
    const datum = payload[0]?.payload as {
      experimentName?: string;
      isBaseline?: boolean;
    };
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
