import { LLMInput } from "./LLMInput";
import { LLMOutput } from "./LLMOutput";
import { LLMToolDefinitions } from "./LLMToolDefinitions";
import type {
  AttributeObject,
  SpanInfoData,
  SpanInfoSectionProps,
} from "./types";
import { getLLMAttributes } from "./utils";

/**
 * The info view for an LLM span — extracts the LLM attribute shapes and
 * renders the input and output cards.
 */
export function LLMSpanInfo({
  span,
  spanAttributes,
  inputSectionProps,
  outputSectionProps,
  toolDefinitionsSectionProps,
}: {
  span: SpanInfoData;
  spanAttributes: AttributeObject;
  inputSectionProps: SpanInfoSectionProps;
  outputSectionProps: SpanInfoSectionProps;
  toolDefinitionsSectionProps: SpanInfoSectionProps;
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
    <>
      <LLMInput
        modelName={modelName}
        provider={provider}
        input={input}
        inputMessages={inputMessages}
        promptTemplate={promptTemplate}
        prompts={prompts}
        invocationParameters={invocationParameters}
        {...inputSectionProps}
      />
      <LLMOutput
        output={output}
        outputMessages={outputMessages}
        {...outputSectionProps}
      />
      {toolSchemas.length > 0 ? (
        <LLMToolDefinitions
          toolSchemas={toolSchemas}
          {...toolDefinitionsSectionProps}
        />
      ) : null}
    </>
  );
}
