import {
  Card,
  CopyToClipboardButton,
  Flex,
  LazyTabPanel,
  Tab,
  TabList,
  Tabs,
  View,
} from "@phoenix/components";
import {
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import type { AttributeMessage } from "@phoenix/openInference/tracing/types";

import { defaultCardProps } from "./constants";
import { LLMMessagesList } from "./LLMMessagesList";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";
import type { SpanIOValue } from "./types";

/**
 * The output side of an LLM span — a card with tabs for the output messages
 * and the raw output value. Renders nothing when the span has no output.
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
  if (!hasOutput && !hasOutputMessages) {
    return null;
  }
  return (
    <Card {...defaultCardProps} title="Output" titleSeparator={false}>
      <Tabs>
        <TabList>
          {hasOutputMessages && <Tab id="output-messages">Output Messages</Tab>}
          {hasOutput && <Tab id="output">Output</Tab>}
        </TabList>

        {hasOutputMessages && (
          <LazyTabPanel id="output-messages">
            <LLMMessagesList messages={outputMessages} />
          </LazyTabPanel>
        )}
        {hasOutput && (
          <LazyTabPanel id="output">
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
          </LazyTabPanel>
        )}
      </Tabs>
    </Card>
  );
}
