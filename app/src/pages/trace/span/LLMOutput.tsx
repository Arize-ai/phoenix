import { Card, CopyToClipboardButton, Flex, View } from "@phoenix/components";
import {
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import type { AttributeMessage } from "@phoenix/openInference/tracing/types";

import { defaultCardProps } from "./constants";
import type { LLMIOView } from "./LLMIOViewSelect";
import { LLMIOViewSelect, useLLMIOView } from "./LLMIOViewSelect";
import { LLMMessagesList } from "./LLMMessagesList";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";
import type { SpanIOValue } from "./types";

/**
 * The output side of an LLM span — a card with a view select for the output
 * messages and the raw output value. Renders nothing when the span has no
 * output.
 */
export function LLMOutput({
  output,
  outputMessages,
}: {
  /** The raw output value of the span */
  output: SpanIOValue | null;
  outputMessages: AttributeMessage[];
}) {
  const hasOutput = output != null && output.value != null;
  const hasOutputMessages = outputMessages.length > 0;

  const views: LLMIOView[] = [];
  if (hasOutputMessages)
    views.push({ id: "output-messages", label: "Messages" });
  if (hasOutput) views.push({ id: "output", label: "Raw" });
  const { view, setView } = useLLMIOView(views);

  if (!hasOutput && !hasOutputMessages) {
    return null;
  }
  return (
    <Card
      {...defaultCardProps}
      title="Output"
      extra={
        views.length > 0 ? (
          <LLMIOViewSelect
            label="Output view"
            views={views}
            value={view ?? ""}
            onChange={setView}
          />
        ) : undefined
      }
    >
      {view === "output-messages" && (
        <LLMMessagesList messages={outputMessages} />
      )}
      {view === "output" && hasOutput && (
        <View padding="size-200">
          <MarkdownDisplayProvider>
            <Card
              {...defaultCardProps}
              title="LLM Output"
              extra={
                <Flex direction="row" gap="size-100">
                  <ConnectedMarkdownModeSelect />
                  <CopyToClipboardButton text={output.value} />
                </Flex>
              }
            >
              <MimeTypeCodeBlock {...output} />
            </Card>
          </MarkdownDisplayProvider>
        </View>
      )}
    </Card>
  );
}
