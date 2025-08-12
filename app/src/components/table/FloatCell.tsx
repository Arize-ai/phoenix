import { CellContext } from "@tanstack/react-table";
import { css } from "@emotion/react";

import { isNumberOrNull } from "@phoenix/typeUtils";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

const floatRightCSS = css`
  float: right;
`;

/**
 * A table cell that nicely formats the value of a float.
 */
export function FloatCell<TData extends object, TValue>({
  getValue,
}: CellContext<TData, TValue>) {
  const value = getValue();
  if (!isNumberOrNull(value)) {
    throw new Error("IntCell only supports number or null values.");
  }
  return (
    <span
      title={value != null ? String(value) : ""}
      className="font-mono"
      css={floatRightCSS}
    >
      {floatFormatter(value)}
    </span>
  );
}
