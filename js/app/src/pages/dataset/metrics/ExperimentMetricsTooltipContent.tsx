import type { ReactNode } from "react";
import type { TooltipContentProps } from "recharts";

import { ChartTooltip, ChartTooltipItem } from "@phoenix/components/chart";

import type { ExperimentReferenceLabel } from "./ExperimentBaselineReference";
import { ExperimentMetricsTooltipHeader } from "./ExperimentMetricsTooltipHeader";

type ValueFormatter = (value: number | null | undefined) => string;

/**
 * The experiment fields every experiment metric chart datum carries for its
 * tooltip header.
 */
export type ExperimentMetricsTooltipDatum = {
  experimentName?: string;
  experimentColor?: string;
  isBaseline?: boolean;
  referenceLabel?: ExperimentReferenceLabel;
};

/**
 * Builds the tooltip content for an experiment metric chart: the shared
 * experiment header followed by one row per series. Each row's swatch comes
 * from the series' own payload entry so it always matches the rendered mark,
 * and missing values reach the formatter as null (rendered "--") instead of
 * being coerced to a fake zero. Chart specific rows (e.g. run counts) follow
 * the series rows.
 */
export function makeExperimentMetricsTooltipContent<
  TDatum extends ExperimentMetricsTooltipDatum = ExperimentMetricsTooltipDatum,
>({
  valueFormatter,
  renderDetails,
}: {
  valueFormatter: ValueFormatter;
  renderDetails?: (datum: TDatum) => ReactNode;
}) {
  return function ExperimentMetricsTooltipContent({
    active,
    payload,
    label,
  }: TooltipContentProps) {
    if (!active || !payload || payload.length === 0) {
      return null;
    }
    const datum = payload[0]?.payload as TDatum;
    return (
      <ChartTooltip>
        <ExperimentMetricsTooltipHeader
          sequenceNumber={Number(label)}
          name={datum?.experimentName}
          isBaseline={datum?.isBaseline}
          color={datum?.experimentColor}
          referenceLabel={datum?.referenceLabel}
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
        {datum != null && renderDetails?.(datum)}
      </ChartTooltip>
    );
  };
}
