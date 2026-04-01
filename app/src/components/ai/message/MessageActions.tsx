import { messageActionsCSS } from "./styles";
import type { MessageActionsProps } from "./types";

/**
 * Horizontal row of {@link MessageAction} buttons. Renders with
 * `role="toolbar"` for accessibility and pushes itself to the trailing
 * edge of the parent via `margin-left: auto`.
 *
 * Typically placed inside a {@link MessageToolbar}.
 *
 * @example
 * ```tsx
 * <MessageToolbar>
 *   <MessageActions>
 *     <MessageAction label="Copy" tooltip="Copy" onPress={handleCopy}>
 *       <Icon svg={<Icons.DuplicateOutline />} />
 *     </MessageAction>
 *   </MessageActions>
 * </MessageToolbar>
 * ```
 */
export function MessageActions({
  children,
  ref,
  ...restProps
}: MessageActionsProps) {
  return (
    <div ref={ref} css={messageActionsCSS} role="toolbar" {...restProps}>
      {children}
    </div>
  );
}
