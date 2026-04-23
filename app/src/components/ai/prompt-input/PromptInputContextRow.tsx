import { css } from "@emotion/react";

import type { PromptInputContextRowProps } from "./types";

const promptInputContextRowCSS = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--global-dimension-size-75);
  padding: var(--global-dimension-size-150) var(--global-dimension-size-150) 0;
`;

export function PromptInputContextRow({
  children,
  ref,
  ...restProps
}: PromptInputContextRowProps) {
  return (
    <div ref={ref} css={promptInputContextRowCSS} {...restProps}>
      {children}
    </div>
  );
}
