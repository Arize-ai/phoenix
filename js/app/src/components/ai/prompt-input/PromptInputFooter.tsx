import { promptInputFooterCSS } from "./styles";
import type { PromptInputFooterProps } from "./types";

/**
 * Footer toolbar displayed below the textarea. Lays out `PromptInputTools`
 * on the left and `PromptInputActions` on the right.
 */
export function PromptInputFooter({
  children,
  ref,
  ...restProps
}: PromptInputFooterProps) {
  return (
    <div ref={ref} css={promptInputFooterCSS} {...restProps}>
      {children}
    </div>
  );
}
