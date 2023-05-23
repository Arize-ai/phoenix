import React from "react";

import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

/**
 * A table cell that nicely formats the value of a float.
 */
export function FloatCell({ value }: { value: number | null }) {
  return (
    <span title={value != null ? String(value) : ""}>
      {floatFormatter(value)}
    </span>
  );
}
