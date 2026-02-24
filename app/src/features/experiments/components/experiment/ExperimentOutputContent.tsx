import { DynamicContent } from "@phoenix/components/DynamicContent";
import { MarkdownBlock } from "@phoenix/components/markdown";
import { useExtractedOutputContent } from "@phoenix/hooks/useExtractedOutputContent";

export interface ExperimentOutputContentProps {
  /**
   * The experiment output value to render.
   * If this matches the chat message format (with assistant messages),
   * the content will be rendered as markdown.
   */
  value: unknown;
}

/**
 * Component that intelligently renders experiment output content.
 *
 * If the output is a chat message format containing assistant messages,
 * it extracts the assistant content and renders it as markdown.
 * Otherwise, it falls back to rendering as JSON or plain text via DynamicContent.
 *
 * @example
 * // Chat message format - renders markdown
 * <ExperimentOutputContent value={{ messages: [{ role: "assistant", content: "# Hello" }] }} />
 *
 * // Other formats - renders via DynamicContent
 * <ExperimentOutputContent value={{ response: "Hello world" }} />
 */
export function ExperimentOutputContent({
  value,
}: ExperimentOutputContentProps) {
  const result = useExtractedOutputContent(value);

  if (result.isExtracted) {
    // TypeScript knows result.content is string here
    return (
      <MarkdownBlock mode="markdown" margin="none">
        {result.content}
      </MarkdownBlock>
    );
  }

  // TypeScript knows result.content is the original type here
  return <DynamicContent value={result.content} />;
}
