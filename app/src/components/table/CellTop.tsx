import { ReactNode } from "react";
import { css } from "@emotion/react";

/**
 * A component that renders a row at the top of a table cell
 */
export function CellTop({
  children,
  extra,
}: {
  children?: ReactNode;
  /**
   * Additional content like controls that will be placed on the right
   */
  extra?: ReactNode;
}) {
  return (
    <div css={cellTopCSS}>
      <div css={childrenWrapCSS}>{children}</div>
      <div css={extraCSS}>{extra}</div>
    </div>
  );
}

const cellTopCSS = css`
  padding: 0 var(--ac-global-dimension-static-size-100) 0
    var(--ac-global-dimension-static-size-200);
  border-bottom: var(--ac-global-border-size-thin) solid
    var(--ac-global-color-grey-200);
  background-color: var(--ac-global-color-grey-50);
  min-height: 39px;
  display: flex;
  flex-direction: row;
  gap: var(--ac-global-dimension-static-size-100);
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  flex: none;
`;

const childrenWrapCSS = css`
  height: 100%;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
`;

const extraCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--ac-global-dimension-static-size-50);
  align-items: center;
  flex: none;
`;
