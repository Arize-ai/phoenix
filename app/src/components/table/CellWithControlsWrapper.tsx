import React, { PropsWithChildren, ReactNode } from "react";
import { css } from "@emotion/react";

const cellWithControlsWrapCSS = css`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  min-height: 75px;
  padding: var(--ac-global-dimension-static-size-200);
  .controls {
    transition: opacity 0.2s ease-in-out;
    opacity: 0;
    display: none;
    z-index: 1;
  }
  &:hover .controls {
    opacity: 1;
    display: flex;
    // make them stand out
    .ac-button {
      border-color: var(--ac-global-color-primary);
    }
  }
`;

const cellControlsCSS = css`
  position: absolute;
  top: -4px;
  right: 0px;
  display: flex;
  flex-direction: row;
  gap: var(--ac-global-dimension-static-size-100);
`;

/**
 * Wraps a cell to provides space for controls that are shown on hover.
 */
export function CellWithControlsWrap(
  props: PropsWithChildren<{ controls: ReactNode }>
) {
  return (
    <div css={cellWithControlsWrapCSS}>
      {props.children}
      <div css={cellControlsCSS} className="controls">
        {props.controls}
      </div>
    </div>
  );
}
