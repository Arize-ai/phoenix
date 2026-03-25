import type { Ref } from "react";
import { forwardRef } from "react";

import { promptInputBodyCSS } from "./styles";
import type { PromptInputBodyProps } from "./types";

/**
 * Scrollable body region that wraps the textarea.
 * Provides padding around the text input area.
 */
function PromptInputBody(
  { children, ...restProps }: PromptInputBodyProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div ref={ref} css={promptInputBodyCSS} {...restProps}>
      {children}
    </div>
  );
}

const _PromptInputBody = forwardRef(PromptInputBody);
_PromptInputBody.displayName = "PromptInputBody";
export { _PromptInputBody as PromptInputBody };
