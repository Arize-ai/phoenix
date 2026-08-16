import { css } from "@emotion/react";
import type { ReactNode } from "react";

const chartFrameCSS = css`
  border: 1px solid var(--global-color-gray-200);
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-size-150);
  background: var(--global-color-gray-75);
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
`;

const chartTitleCSS = css`
  margin-bottom: var(--global-dimension-size-150);
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--global-color-gray-600);
  font-size: var(--global-dimension-font-size-75);
`;

export function ChartFrame({
  title,
  children,
}: {
  title: string | null;
  children: ReactNode;
}) {
  return (
    <div css={chartFrameCSS}>
      {title ? (
        <div css={chartTitleCSS}>
          <span>{title}</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}
