import type { Ref } from "react";
import { forwardRef } from "react";

import { promptInputFooterCSS } from "./styles";
import type { PromptInputFooterProps } from "./types";

/**
 * Footer toolbar displayed below the textarea. Lays out `PromptInputTools`
 * on the left and `PromptInputActions` on the right.
 */
function PromptInputFooter(
  { children, ...restProps }: PromptInputFooterProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div ref={ref} css={promptInputFooterCSS} {...restProps}>
      {children}
    </div>
  );
}

const _PromptInputFooter = forwardRef(PromptInputFooter);
_PromptInputFooter.displayName = "PromptInputFooter";
export { _PromptInputFooter as PromptInputFooter };
