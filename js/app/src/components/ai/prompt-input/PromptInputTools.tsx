import { promptInputToolsCSS } from "./styles";
import type { PromptInputToolsProps } from "./types";

/**
 * Left-aligned container in the footer for tool buttons, menus, and controls.
 * Renders with `role="toolbar"` for accessibility. Can be empty to reserve
 * layout space so actions stay right-aligned.
 */
export function PromptInputTools({
  children,
  ref,
  ...restProps
}: PromptInputToolsProps) {
  return (
    <div ref={ref} css={promptInputToolsCSS} role="toolbar" {...restProps}>
      {children}
    </div>
  );
}
