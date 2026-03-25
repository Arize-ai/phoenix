import type { Ref } from "react";
import { forwardRef } from "react";

import { promptInputToolsCSS } from "./styles";
import type { PromptInputToolsProps } from "./types";

/**
 * Left-aligned container in the footer for tool buttons, menus, and controls.
 * Renders with `role="toolbar"` for accessibility. Can be empty to reserve
 * layout space so actions stay right-aligned.
 */
function PromptInputTools(
  { children, ...restProps }: PromptInputToolsProps,
  ref: Ref<HTMLDivElement>
) {
  return (
    <div ref={ref} css={promptInputToolsCSS} role="toolbar" {...restProps}>
      {children}
    </div>
  );
}

const _PromptInputTools = forwardRef(PromptInputTools);
_PromptInputTools.displayName = "PromptInputTools";
export { _PromptInputTools as PromptInputTools };
