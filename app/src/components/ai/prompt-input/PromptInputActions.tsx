import type { Ref } from "react";
import { forwardRef } from "react";

import { promptInputActionsCSS } from "./styles";
import type { PromptInputActionsProps } from "./types";

/**
 * Right-aligned container in the footer for primary actions like the
 * submit button.
 */
function PromptInputActions(
  { children, ...restProps }: PromptInputActionsProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div ref={ref} css={promptInputActionsCSS} {...restProps}>
      {children}
    </div>
  );
}

const _PromptInputActions = forwardRef(PromptInputActions);
_PromptInputActions.displayName = "PromptInputActions";
export { _PromptInputActions as PromptInputActions };
