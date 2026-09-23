import type { TooltipContentProps } from "recharts";

import { Text, Truncate } from "@phoenix/components";
import {
  ChartTooltip,
  ChartTooltipDivider,
  ChartTooltipItem,
} from "@phoenix/components/chart";
import { percentFormatter } from "@phoenix/utils/numberFormatUtils";

type ModelTokenDetailTooltipContentProps = Partial<TooltipContentProps> & {
  /** Label for the total row, e.g. "Total cost". */
  totalLabel: string;
  /** Renders a metric value in the unit the chart is measured in. */
  valueFormatter: (value: number) => string;
};

/**
 * Tooltip for the model token-breakdown charts: one row per token type with
 * its share of the model's total, then the total itself.
 */
export function ModelTokenDetailTooltipContent({
  active,
  label,
  payload,
  totalLabel,
  valueFormatter,
}: ModelTokenDetailTooltipContentProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const total = payload[0]?.payload?.total;
  return (
    <ChartTooltip>
      {label && (
        <Text weight="heavy" size="S" minWidth={0}>
          <Truncate maxWidth="100%" title={String(label)}>
            {String(label)}
          </Truncate>
        </Text>
      )}
      {payload.map((entry) => {
        const value = Number(entry.value);
        const share =
          typeof total === "number" && total > 0
            ? ` (${percentFormatter((value / total) * 100)})`
            : "";
        return (
          <ChartTooltipItem
            color={entry.color ?? "transparent"}
            key={String(entry.dataKey ?? entry.name)}
            shape="circle"
            name={String(entry.name ?? entry.dataKey ?? "unknown")}
            value={`${valueFormatter(value)}${share}`}
          />
        );
      })}
      <ChartTooltipDivider />
      <ChartTooltipItem
        name={totalLabel}
        value={valueFormatter(typeof total === "number" ? total : 0)}
      />
    </ChartTooltip>
  );
}
