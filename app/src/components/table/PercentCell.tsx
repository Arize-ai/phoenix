import React from "react";

import { percentFormatter } from "@phoenix/utils/numberFormatUtils";

/**
 * A table cell that nicely formats the value of a percent.
 */
export function PercentCell({ value }: { value: number | null }) {
  return (
    <span title={value != null ? String(value) : ""}>
      {percentFormatter(value)}
    </span>
  );
}
