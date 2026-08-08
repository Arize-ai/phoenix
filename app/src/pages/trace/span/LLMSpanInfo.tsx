import { Flex } from "@phoenix/components";

import { LLMInput } from "./LLMInput";
import { LLMMessagesCollapseProvider } from "./LLMMessagesCollapseContext";
import { LLMOutput } from "./LLMOutput";
import type { AttributeObject, SpanInfoData } from "./types";
import { getLLMAttributes } from "./utils";

/**
 * The info view for an LLM span — extracts the LLM attribute shapes and
 * renders the input and output cards.
 */
export function LLMSpanInfo({
  span,
  spanAttributes,
}: {
  span: SpanInfoData;
  spanAttributes: AttributeObject;
}) {
  const { input, output } = span;
  const {
    modelName,
    provider,
    inputMessages,
    outputMessages,
    toolSchemas,
    prompts,
    promptTemplate,
    invocationParameters,
  } = getLLMAttributes(spanAttributes);

  return (
    <Flex direction="column" gap="size-200">
      {/* the span is passed so that expanding a message in one span does not
          decide what the next span the reader opens looks like */}
      <LLMMessagesCollapseProvider spanId={span.id} messages={inputMessages}>
        <LLMInput
          modelName={modelName}
          provider={provider}
          input={input}
          inputMessages={inputMessages}
          toolSchemas={toolSchemas}
          promptTemplate={promptTemplate}
          prompts={prompts}
          invocationParameters={invocationParameters}
        />
      </LLMMessagesCollapseProvider>
      <LLMMessagesCollapseProvider spanId={span.id} messages={outputMessages}>
        <LLMOutput output={output} outputMessages={outputMessages} />
      </LLMMessagesCollapseProvider>
    </Flex>
  );
}
