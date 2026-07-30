import { CopyToClipboardButton, Flex, Text } from "@phoenix/components";
import {
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import type { AttributeMessage } from "@phoenix/openInference/tracing/types";

import { SpanDetailsDisclosureSection } from "../SpanDetailsDisclosureSection";
import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import type { LLMIOView } from "./LLMIOViewSelect";
import { LLMIOViewSelect, useLLMIOView } from "./LLMIOViewSelect";
import { LLMMessagesList } from "./LLMMessagesList";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";
import type { SpanInfoSectionProps, SpanIOValue } from "./types";
import { countToolCalls, formatJSONForCopy } from "./utils";

/**
 * The output side of an LLM span — a card with a view select for the output
 * messages and the raw output value. Renders nothing when the span has no
 * output.
 */
export function LLMOutput({
  output,
  outputMessages,
  sectionId,
  bordered,
}: {
  /** The raw output value of the span */
  output: SpanIOValue | null;
  outputMessages: AttributeMessage[];
} & SpanInfoSectionProps) {
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
      <SpanDetailsDisclosureSection
        sectionId={sectionId}
        bordered={bordered}
        {...cardProps}
        title="Output"
        titleExtra={
          toolCallCount > 0 ? (
            <Text color="text-700">
              {`${toolCallCount} ${
                toolCallCount === 1 ? "tool call" : "tool calls"
              }`}
            </Text>
          ) : undefined
        }
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            {isRawView && <ConnectedMarkdownModeSelect />}
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
        {isRawView && <MimeTypeCodeBlock {...output} initializeImmediately />}
      </SpanDetailsDisclosureSection>
    </MarkdownDisplayProvider>
  );
}
