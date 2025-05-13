import { useMemo } from "react";
import { CellContext } from "@tanstack/react-table";

import { Text } from "@phoenix/components";
import { percentFormatter } from "@phoenix/utils/numberFormatUtils";
/**
 * A table cell that nicely formats the error rate,
 * highlighting issues when the number gets high
 */
export function ErrorRateCell<TData extends object, TValue>({
  getValue,
}: CellContext<TData, TValue>) {
  const value = getValue() as number;
  const percent = value !== null ? value * 100 : null;
  const color = useMemo(() => {
    if (percent === null) {
      return undefined;
    } else if (percent >= 80) {
      return "red-1100";
    } else if (percent > 0) {
      return "orange-1100";
    } else {
      return "green-1100";
    }
  }, [percent]);
  return <Text color={color}>{percentFormatter(percent)}</Text>;
}
