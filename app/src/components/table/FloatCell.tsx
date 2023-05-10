import React from "react";
import { format } from "d3-format";

const formatter = format(".2f");
/**
 * A table cell that nicely formats the value of a float.
 */
export function FloatCell({ value }: { value: number | null }) {
  return (
    <span title={value != null ? String(value) : ""}>
      {value != null ? formatter(value) : "--"}
    </span>
  );
}
