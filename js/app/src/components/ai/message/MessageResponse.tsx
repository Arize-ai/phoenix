import { MarkdownBlock } from "../../markdown/MarkdownBlock";
import type { MessageResponseProps } from "./types";

/**
 * Renders a markdown string as rich content using {@link MarkdownBlock}.
 * Supports both static and streaming render modes for incremental output.
 *
 * Should be placed inside a {@link MessageContent} for proper styling.
 *
 * @example
 * ```tsx
 * <MessageContent>
 *   <MessageResponse>{markdownString}</MessageResponse>
 * </MessageContent>
 *
 * // Streaming mode for incremental content
 * <MessageContent>
 *   <MessageResponse renderMode="streaming">{partial}</MessageResponse>
 * </MessageContent>
 * ```
 */
export function MessageResponse({
  children,
  renderMode = "static",
}: MessageResponseProps) {
  return (
    <MarkdownBlock mode="markdown" renderMode={renderMode} margin="none">
      {children}
    </MarkdownBlock>
  );
}
