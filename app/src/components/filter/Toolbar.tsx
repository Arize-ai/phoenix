import { ReactNode } from "react";
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
      css={css`
        padding: var(--ac-global-dimension-static-size-50)
          var(--ac-global-dimension-static-size-200);
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        gap: var(--ac-global-dimension-static-size-100);
        border-bottom: 1px solid var(--ac-global-border-color-dark);
        flex: none;
        min-height: 29px;
        .toolbar__main {
          display: flex;
          flex-direction: row;
          gap: var(--ac-global-dimension-static-size-100);
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
