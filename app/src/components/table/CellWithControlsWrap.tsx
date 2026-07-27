import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";

import { embeddedCopyButtonSizeCSS } from "@phoenix/components/core/copy/styles";
import { revealOnHoverCSS } from "@phoenix/components/core/styles";

const cellWithControlsWrapCSS = css`
  position: relative;
  display: flex;
  flex-direction: column;
  margin: calc(-1 * var(--global-table-cell-padding-y))
    calc(-1 * var(--global-table-cell-padding-x));
  width: calc(100% + 2 * var(--global-table-cell-padding-x));
  min-height: calc(100% + 2 * var(--global-table-cell-padding-y));

  & > :not(.controls) {
    // Re-add the padding
    padding: var(--global-table-cell-padding-y)
      var(--global-table-cell-padding-x);
    flex: 1;
    display: flex;
    align-items: center;
  }
  // Top-aligned when asked for, and inside a table whose rows are expanded.
  &[data-align="top"] > :not(.controls),
  [data-rows="expanded"] & > :not(.controls) {
    align-items: flex-start;
  }
  .controls {
    ${revealOnHoverCSS}
    transition: opacity 0.1s ease-in-out;
    z-index: 1;
  }
  // Revealed on focus as well as hover: the control is reachable by keyboard,
  // so leaving it invisible while focused hides where the focus actually is
  &:hover .controls,
  &:focus-within .controls {
    opacity: 1;
  }

  // Only the measurement, not the styling: how a cell's control looks belongs
  // to the table that renders it, and every table in the app shares this
  // wrapper. The top-aligned rule below needs the size to place the control
  // against the first line of text.
  ${embeddedCopyButtonSizeCSS}
`;

const cellControlsCSS = css`
  position: absolute;
  right: var(--global-table-cell-controls-offset);
  // Centred on the cell's content, which for the single line row of a centred
  // cell is the line itself, so the control reads as part of what it copies
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: row;
  gap: var(--global-table-cell-controls-gap);

  // Content starting at the top of a taller row keeps its control beside the
  // first line rather than letting it drift down the space below.
  [data-align="top"] > &,
  [data-rows="expanded"] & {
    top: calc(
      var(--global-table-cell-padding-y) +
        (var(--global-line-height-s) - var(--embedded-copy-button-size)) / 2
    );
    transform: none;
  }
`;

/**
 * Wraps a cell to provide space for controls shown on hover or focus, laid out
 * at the cell's right edge alongside the content they act on.
 */
export function CellWithControlsWrap({
  controls,
  align = "center",
  children,
}: PropsWithChildren<{
  controls: ReactNode;
  /**
   * Where the cell's content sits within a taller row. `top` for cells whose
   * content wraps to several lines, so a key reads from the same baseline as
   * the value beside it; `center` for the single-line identifiers and names
   * that most tables show.
   * @default "center"
   */
  align?: "center" | "top";
}>) {
  return (
    <div
      css={cellWithControlsWrapCSS}
      data-align={align}
      data-testid="cell-with-controls-wrap"
    >
      {children}
      <div css={cellControlsCSS} className="controls">
        {controls}
      </div>
    </div>
  );
}
