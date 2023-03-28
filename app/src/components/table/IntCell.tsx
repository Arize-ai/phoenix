import React from "react";
import { format } from "d3-format";

const formatter = format("d");
/**
 * A table cell that nicely formats the value of an int.
 */
export function IntCell({ value }: { value: number | null }) {
  return (
    <span title={value != null ? String(value) : ""}>
      {value != null ? formatter(value) : "--"}
    </span>
  );
}
