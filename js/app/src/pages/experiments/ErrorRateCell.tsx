import type { CellContext } from "@tanstack/react-table";

import { Text } from "@phoenix/components";
import { percentFormatter } from "@phoenix/utils/numberFormatUtils";

/**
 * An error rate as a percentage, colored by how high it is: green at zero,
 * orange above it, and red once most runs fail.
 */
export function ErrorRateText({ errorRate }: { errorRate: number | null }) {
  const percent = errorRate !== null ? errorRate * 100 : null;
  const color =
    percent === null
      ? undefined
      : percent >= 80
        ? "red-1100"
        : percent > 0
          ? "orange-1100"
          : "green-1100";
  return <Text color={color}>{percentFormatter(percent)}</Text>;
}

/**
 * A table cell that nicely formats the error rate,
 * highlighting issues when the number gets high
 */
export function ErrorRateCell<TData extends object, TValue>({
  getValue,
}: CellContext<TData, TValue>) {
  return <ErrorRateText errorRate={getValue() as number | null} />;
}
