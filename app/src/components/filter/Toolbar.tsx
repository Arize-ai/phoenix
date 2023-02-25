import React, { ReactNode } from "react";

import { css } from "@emotion/react";

type ToolbarProps = {
  children?: ReactNode;
  /**
   * Extra content to render in the toolbar. Aligned to the left
   */
  extra?: ReactNode;
};
/**
 * A wrapper component for a toolbar.
 */
export function Toolbar(props: ToolbarProps) {
  return (
    <div
      role="toolbar"
      css={(theme) => css`
        padding: ${theme.spacing.padding8}px ${theme.spacing.padding16}px;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        gap: ${theme.spacing.padding8}px;
        border-bottom: 1px solid ${theme.colors.gray500};
        flex: none;
        min-height: 29px;
        .toolbar__main {
          display: flex;
          flex-direction: row;
          gap: ${theme.spacing.padding8}px;
        }
      `}
    >
      <div data-testid="toolbar-main" className="toolbar__main">
        {props.children}
      </div>
      {props.extra ? (
        <div data-testid="toolbar-extra">{props.extra}</div>
      ) : null}
    </div>
  );
}
