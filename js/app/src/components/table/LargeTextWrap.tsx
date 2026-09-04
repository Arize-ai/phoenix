import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";

export interface LargeTextWrapProps extends PropsWithChildren {
  height?: number;
}

export function LargeTextWrap({ children, height = 300 }: LargeTextWrapProps) {
  return (
    <div
      data-testid="large-text-wrap"
      css={css`
        height: ${height}px;
        overflow-y: auto;
        flex: 1 1 auto;
      `}
    >
      {children}
    </div>
  );
}
