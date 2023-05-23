import React from "react";

import { intFormatter } from "@phoenix/utils/numberFormatUtils";

/**
 * A table cell that nicely formats the value of an int.
 */
export function IntCell({ value }: { value: number | null }) {
  return (
    <span title={value != null ? String(value) : ""}>
      {intFormatter(value)}
    </span>
  );
}
