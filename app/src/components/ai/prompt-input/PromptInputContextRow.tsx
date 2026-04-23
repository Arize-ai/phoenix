import { css } from "@emotion/react";
import type { HTMLAttributes, ReactNode, Ref } from "react";

const promptInputContextRowCSS = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--global-dimension-size-75);
  padding: var(--global-dimension-size-150) var(--global-dimension-size-150) 0;
`;

export interface PromptInputContextRowProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

/**
 * Row rendered above the prompt body that surfaces contextual pills (e.g.
 * the project or trace the agent is currently aware of). Intentionally a
 * presentational container — the actual pill content is supplied by the
 * consumer.
 */
export function PromptInputContextRow({
  children,
  ref,
  ...rest
}: PromptInputContextRowProps) {
  return (
    <div ref={ref} css={promptInputContextRowCSS} {...rest}>
      {children}
    </div>
  );
}
