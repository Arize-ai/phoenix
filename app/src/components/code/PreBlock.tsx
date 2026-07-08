import { css } from "@emotion/react";

export function PreBlock({ children }: { children: string }) {
  return (
    <pre
      data-testid="pre-block"
      css={css`
        white-space: pre-wrap;
        padding: var(--global-dimension-static-size-200);
        font-size: var(--global-font-size-s);
      `}
    >
      {children}
    </pre>
  );
}
