import { css } from "@emotion/react";

import { CopyToClipboardButton, Text } from "@phoenix/components";
import { truncateSingleCSS } from "@phoenix/components/core/utility/Truncate";

import { CellWithControlsWrap } from "./CellWithControlsWrap";

const copyableTextCellCSS = css`
  // The cell wrap lays its children out as a flex row, so the value needs to be
  // a block box for the ellipsis to act on, and out of its content width so
  // there is something to clip.
  .copyable-text-cell__value {
    display: block;
    min-width: 0;
    ${truncateSingleCSS};
  }
  // Ids carry no break opportunities of their own, so they may break anywhere
  // rather than widen the column.
  [data-rows="expanded"] & .copyable-text-cell__value {
    white-space: normal;
    overflow-wrap: anywhere;
  }
`;

export interface CopyableTextCellProps {
  /** The text to display. Renders "--" when null or empty. */
  value?: string | null;
}

/**
 * A table cell displaying text with a copy-to-clipboard control, e.g. for
 * identifiers such as span, trace, and session ids. The value is truncated to
 * a single line, or wrapped in full when the table's rows are expanded.
 */
export function CopyableTextCell({ value }: CopyableTextCellProps) {
  if (!value) {
    return <>{"--"}</>;
  }
  return (
    <CellWithControlsWrap controls={<CopyToClipboardButton text={value} />}>
      <div css={copyableTextCellCSS}>
        <Text fontFamily="mono" className="copyable-text-cell__value">
          {value}
        </Text>
      </div>
    </CellWithControlsWrap>
  );
}
