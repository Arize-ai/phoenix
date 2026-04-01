import { MessageContext } from "./MessageContext";
import { messageCSS } from "./styles";
import type { MessageProps } from "./types";

/**
 * Root container for a chat message. Provides the {@link MessageContext} so
 * descendant components can read the `from` participant and renders a styled
 * wrapper with layout direction based on the sender.
 *
 * @example
 * ```tsx
 * <Message from="user">
 *   <MessageContent>Hello!</MessageContent>
 * </Message>
 *
 * <Message from="assistant">
 *   <MessageContent>
 *     <MessageResponse>{markdown}</MessageResponse>
 *   </MessageContent>
 * </Message>
 * ```
 */
export function Message({ children, ref, from, ...restProps }: MessageProps) {
  return (
    <MessageContext.Provider value={{ from }}>
      <div ref={ref} css={messageCSS} data-from={from} {...restProps}>
        {children}
      </div>
    </MessageContext.Provider>
  );
}
