import React from "react";
import { format } from "d3-format";

/**
 * A factory that customizes a table cell that nicely formats the value of a
 * numeric value.
 */
export function NumericCellFactory({
  suffix = "",
  multiplier = 1,
  decimals = 2,
}: {
  suffix?: string;
  multiplier?: number;
  decimals?: number;
}) {
  const formatter = format(decimals ? `.${decimals}f` : "d");
  return function NumericCell({ value }: { value: number | null }) {
    return (
      <span title={value != null ? String(value) : ""}>
        {value != null ? `${formatter(value * multiplier)}${suffix}` : "--"}
      </span>
    );
  };
}
