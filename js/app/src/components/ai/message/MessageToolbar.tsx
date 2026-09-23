import { messageToolbarCSS } from "./styles";
import type { MessageToolbarProps } from "./types";

/**
 * Footer bar placed below a message's content. Provides a horizontal
 * layout for branch navigation ({@link MessageBranchSelector}) and
 * action buttons ({@link MessageActions}).
 *
 * @example
 * ```tsx
 * <Message from="assistant">
 *   <MessageContent>...</MessageContent>
 *   <MessageToolbar>
 *     <MessageBranchSelector>...</MessageBranchSelector>
 *     <MessageActions>...</MessageActions>
 *   </MessageToolbar>
 * </Message>
 * ```
 */
export function MessageToolbar({
  children,
  ref,
  ...restProps
}: MessageToolbarProps) {
  return (
    <div ref={ref} css={messageToolbarCSS} {...restProps}>
      {children}
    </div>
  );
}
