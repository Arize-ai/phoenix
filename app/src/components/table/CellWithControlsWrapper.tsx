import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";

const cellWithControlsWrapCSS = css`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;

  .cell-controls {
    position: absolute;
    right: 0;
    display: flex;
    align-items: center;
    gap: var(--global-dimension-static-size-50);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease-in-out;
  }

  &:hover .cell-controls,
  .cell-controls:focus-within {
    opacity: 1;
    pointer-events: auto;
  }
`;

/**
 * Wraps table cell content to show action controls on hover.
 *
 * Controls are absolutely positioned at the right edge of the cell and
 * fade in on hover. Clicks on the controls area stop propagation so
 * row-level click handlers (e.g. navigation) are not triggered.
 */
export function CellWithControlsWrap(
  props: PropsWithChildren<{ controls: ReactNode }>
) {
  return (
    <div css={cellWithControlsWrapCSS}>
      {props.children}
      <div className="cell-controls" onClick={(e) => e.stopPropagation()}>
        {props.controls}
      </div>
    </div>
  );
}
