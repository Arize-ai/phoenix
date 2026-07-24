import { Flex } from "@phoenix/components";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { LLMInput } from "./LLMInput";
import { LLMInvocationParams } from "./LLMInvocationParams";
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
  const hasInvocationParameters =
    Object.keys(safelyParseJSON(invocationParameters).json || {}).length > 0;

  return (
    <Flex direction="column" gap="size-200">
      <LLMInput
        modelName={modelName}
        provider={provider}
        input={input}
        inputMessages={inputMessages}
        toolSchemas={toolSchemas}
        promptTemplate={promptTemplate}
        prompts={prompts}
      />
      {hasInvocationParameters ? (
        <LLMInvocationParams invocationParameters={invocationParameters} />
      ) : null}
      <LLMOutput output={output} outputMessages={outputMessages} />
    </Flex>
  );
}
