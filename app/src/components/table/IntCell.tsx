import React from "react";
import { CellContext } from "@tanstack/react-table";

import { isNumberOrNull } from "@phoenix/typeUtils";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

/**
 * A table cell that nicely formats the value of an int.
 */
export function IntCell<TData extends object, TValue>({
  getValue,
}: CellContext<TData, TValue>) {
  const value = getValue();
  if (!isNumberOrNull(value)) {
    throw new Error("IntCell only supports number or null values.");
  }
  return (
    <span title={value != null ? String(value) : ""}>
      {intFormatter(value)}
    </span>
  );
}
