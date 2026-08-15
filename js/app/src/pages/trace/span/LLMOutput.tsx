import { Card, CopyToClipboardButton, Flex } from "@phoenix/components";
import {
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import type { AttributeMessage } from "@phoenix/openInference/tracing/types";

import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { defaultCardProps } from "./constants";
import type { LLMIOView } from "./LLMIOViewSelect";
import { LLMIOViewSelect, useLLMIOView } from "./LLMIOViewSelect";
import { LLMMessagesCollapseToggle } from "./LLMMessagesCollapseToggle";
import { LLMMessagesList } from "./LLMMessagesList";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";
import type { SpanIOValue } from "./types";
import { countToolCalls, formatJSONForCopy } from "./utils";

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
  const toolCallCount = countToolCalls(outputMessages);

  const views: LLMIOView[] = [];
  if (hasOutputMessages)
    views.push({ id: "output-messages", label: "Messages" });
  if (hasOutput) views.push({ id: "output", label: "Raw" });
  const { view, setView } = useLLMIOView(views);
  const cardProps = useSpanInfoCardProps("output");

  if (!hasOutput && !hasOutputMessages) {
    return null;
  }

  const isRawView = view === "output" && hasOutput;

  // Whatever the card is showing is what its copy button copies, so the reader
  // never has to switch views to get at the content in front of them
  let copyText: string | null = null;
  switch (view) {
    case "output-messages":
      copyText = formatJSONForCopy(outputMessages);
      break;
    case "output":
      copyText = output?.value ?? null;
      break;
  }

  return (
    <MarkdownDisplayProvider>
      <Card
        {...defaultCardProps}
        {...cardProps}
        title="Output"
        subTitle={
          toolCallCount > 0
            ? `${toolCallCount} ${toolCallCount === 1 ? "tool call" : "tool calls"}`
            : undefined
        }
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            {isRawView && <ConnectedMarkdownModeSelect />}
            {view === "output-messages" && (
              <LLMMessagesCollapseToggle scope="output" />
            )}
            {views.length > 0 && (
              <LLMIOViewSelect
                label="Output view"
                views={views}
                value={view ?? ""}
                onChange={setView}
              />
            )}
            {/* the view switch sits immediately before copy, and copy remains
                last so both controls stay in a consistent place */}
            {copyText != null && <CopyToClipboardButton text={copyText} />}
          </Flex>
        }
      >
        {view === "output-messages" && (
          <LLMMessagesList messages={outputMessages} />
        )}
        {isRawView && <MimeTypeCodeBlock {...output} />}
      </Card>
    </MarkdownDisplayProvider>
  );
}
