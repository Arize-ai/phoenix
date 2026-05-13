import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Text } from "@phoenix/components/core/content";

const chartFrameCSS = css`
  border: 1px solid var(--global-color-gray-300);
  border-radius: var(--global-rounding-small);
  padding: var(--global-dimension-size-150);
  background: var(--global-color-gray-50);
`;

const chartTitleCSS = css`
  margin-bottom: var(--global-dimension-size-100);
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
          <Text weight="heavy">{title}</Text>
        </div>
      ) : null}
      {children}
    </div>
  );
}
