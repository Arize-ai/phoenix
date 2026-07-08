import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";

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
  .controls {
    transition: opacity 0.1s ease-in-out;
    opacity: 0;
    z-index: 1;
  }
  &:hover .controls {
    opacity: 1;
  }
`;

const cellControlsCSS = css`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  right: var(--global-table-cell-controls-offset);
  display: flex;
  flex-direction: row;
  gap: var(--global-table-cell-controls-gap);
`;

/**
 * Wraps a cell to provides space for controls that are shown on hover.
 */
export function CellWithControlsWrap(
  props: PropsWithChildren<{ controls: ReactNode }>
) {
  return (
    <div css={cellWithControlsWrapCSS} data-testid="cell-with-controls-wrap">
      {props.children}
      <div css={cellControlsCSS} className="controls">
        {props.controls}
      </div>
    </div>
  );
}
