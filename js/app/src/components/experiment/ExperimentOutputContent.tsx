import { DynamicContent } from "@phoenix/components/DynamicContent";
import { useExtractedOutputContent } from "@phoenix/hooks/useExtractedOutputContent";

export interface ExperimentOutputContentProps {
  /**
   * The experiment output value to render.
   * If this matches the chat message format (with assistant messages),
   * only the assistant content is rendered.
   */
  value: unknown;
}

/**
 * Component that intelligently renders experiment output content.
 *
 * If the output is a chat message format containing assistant messages,
 * it extracts the assistant content first. The result is rendered via
 * DynamicContent, so JSON (including JSON strings such as structured outputs)
 * is pretty-printed and everything else is rendered as markdown.
 *
 * @example
 * // Chat message format - renders the assistant content
 * <ExperimentOutputContent value={{ messages: [{ role: "assistant", content: "# Hello" }] }} />
 *
 * // Other formats - renders via DynamicContent
 * <ExperimentOutputContent value={{ response: "Hello world" }} />
 */
export function ExperimentOutputContent({
  value,
}: ExperimentOutputContentProps) {
  const content = useExtractedOutputContent(value);
  return <DynamicContent value={content} />;
}
