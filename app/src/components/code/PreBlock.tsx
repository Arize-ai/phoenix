import { css } from "@emotion/react";

export function PreBlock({ children }: { children: string }) {
  return (
    <pre
      data-testid="pre-block"
      css={css`
        white-space: pre-wrap;
        padding: var(--ac-global-dimension-static-size-200);
        font-size: var(--ac-global-font-size-s);
      `}
    >
      {children}
    </pre>
  );
}
