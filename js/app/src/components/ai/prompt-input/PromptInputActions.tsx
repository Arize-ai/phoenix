import { promptInputActionsCSS } from "./styles";
import type { PromptInputActionsProps } from "./types";

/**
 * Right-aligned container in the footer for primary actions like the
 * submit button.
 */
export function PromptInputActions({
  children,
  ref,
  ...restProps
}: PromptInputActionsProps) {
  return (
    <div ref={ref} css={promptInputActionsCSS} {...restProps}>
      {children}
    </div>
  );
}
