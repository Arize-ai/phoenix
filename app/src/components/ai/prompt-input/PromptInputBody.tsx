import { promptInputBodyCSS } from "./styles";
import type { PromptInputBodyProps } from "./types";

/**
 * Scrollable body region that wraps the textarea.
 * Provides padding around the text input area.
 */
export function PromptInputBody({
  children,
  ref,
  ...restProps
}: PromptInputBodyProps) {
  return (
    <div ref={ref} css={promptInputBodyCSS} {...restProps}>
      {children}
    </div>
  );
}
