import type { TooltipContentProps } from "recharts";

import { Text } from "@phoenix/components";
import { ChartTooltip, ChartTooltipItem } from "@phoenix/components/chart";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

/**
 * Shared tooltip for count time series charts: a full timestamp header
 * followed by one integer-formatted row per series.
 */
export function CountTimeSeriesTooltipContent({
  active,
  payload,
  label,
}: TooltipContentProps) {
  const { fullTimeFormatter } = useTimeFormatters();
  if (active && payload && payload.length) {
    return (
      <ChartTooltip>
        {label && (
          <Text weight="heavy" size="S">{`${fullTimeFormatter(
            new Date(Number(label))
          )}`}</Text>
        )}
        {payload.map((entry) => {
          const name = String(entry.dataKey ?? entry.name ?? "unknown");
          return (
            <ChartTooltipItem
              color={entry.color ?? "transparent"}
              key={name}
              shape="circle"
              name={name}
              value={intFormatter(Number(entry.value))}
            />
          );
        })}
      </ChartTooltip>
    );
  }

  return null;
}
