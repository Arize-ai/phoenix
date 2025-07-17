import { CellContext } from "@tanstack/react-table";
import { css } from "@emotion/react";

import { isNumberOrNull } from "@phoenix/typeUtils";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

const floatRightCSS = css`
  float: right;
`;
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
    <span title={value != null ? String(value) : ""} css={floatRightCSS}>
      {intFormatter(value)}
    </span>
  );
}
