import type { ReactNode } from "react";

import {
  Card,
  CopyToClipboardButton,
  Flex,
  LazyTabPanel,
  Tab,
  TabList,
  Tabs,
  Text,
  View,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative";
import {
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import { SpanKindIcon } from "@phoenix/components/trace";
import type {
  AttributeMessage,
  AttributePromptTemplate,
} from "@phoenix/openInference/tracing/types";
import { isModelProvider } from "@phoenix/utils/generativeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { ReadonlyJSONBlock } from "../ReadonlyJSONBlock";
import { defaultCardProps } from "./constants";
import { CopyToClipboardWrap } from "./CopyToClipboardWrap";
import { LLMMessagesList } from "./LLMMessagesList";
import { LLMPromptsList } from "./LLMPromptsList";
import { LLMPromptTemplate } from "./LLMPromptTemplate";
import { LLMToolSchemasList } from "./LLMToolSchemasList";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";
import type { SpanIOValue } from "./types";

/**
 * The input side of an LLM span — the model card with tabs for input
 * messages, tools, raw input, prompt template, prompts, and invocation
 * parameters.
 */
export function LLMInput({
  modelName,
  provider,
  input,
  inputMessages,
  toolSchemas,
  promptTemplate,
  prompts,
  invocationParameters,
}: {
  /** The name of the model that was invoked */
  modelName: string | null;
  /** The model provider (e.g. openai) used to pick the provider icon */
  provider: string | null;
  /** The raw input value of the span */
  input: SpanIOValue | null;
  inputMessages: AttributeMessage[];
  /** The JSON schemas of the tools available to the LLM */
  toolSchemas: string[];
  promptTemplate: AttributePromptTemplate | null;
  prompts: string[];
  /** The invocation parameters as a JSON string */
  invocationParameters: string;
}) {
  let modelNameTitleEl: ReactNode = null;
  if (modelName != null) {
    let icon = <SpanKindIcon spanKind="llm" />;
    const normalizedProvider = provider?.toUpperCase();
    // Show the provider if it exists
    if (
      typeof normalizedProvider === "string" &&
      isModelProvider(normalizedProvider)
    ) {
      icon = <GenerativeProviderIcon provider={normalizedProvider} />;
    }
    modelNameTitleEl = (
      <Flex direction="row" gap="size-100" alignItems="center">
        {icon}
        <Text size="M" weight="heavy">
          {modelName}
        </Text>
      </Flex>
    );
  }

  const hasInput = input != null && input.value != null;
  const hasInputMessages = inputMessages.length > 0;
  const hasLLMToolSchemas = toolSchemas.length > 0;
  const hasPrompts = prompts.length > 0;
  const hasInvocationParams =
    Object.keys(safelyParseJSON(invocationParameters).json || {}).length > 0;
  const hasPromptTemplateObject = promptTemplate != null;

  return (
    <Card collapsible titleSeparator={false} title={modelNameTitleEl}>
      <Tabs>
        <TabList>
          {hasInputMessages && <Tab id="input-messages">Input Messages</Tab>}
          {hasLLMToolSchemas && <Tab id="tools">Tools</Tab>}
          {hasInput && <Tab id="input">Input</Tab>}
          {hasPromptTemplateObject && (
            <Tab id="prompt-template">Prompt Template</Tab>
          )}
          {hasPrompts && <Tab id="prompts">Prompts</Tab>}
          {hasInvocationParams && (
            <Tab id="invocation-params">Invocation Params</Tab>
          )}
        </TabList>

        {hasInputMessages && (
          <LazyTabPanel id="input-messages">
            <LLMMessagesList messages={inputMessages} />
          </LazyTabPanel>
        )}

        {hasLLMToolSchemas && (
          <LazyTabPanel id="tools">
            <LLMToolSchemasList toolSchemas={toolSchemas} />
          </LazyTabPanel>
        )}

        {hasInput && (
          <LazyTabPanel id="input">
            <View padding="size-200">
              <MarkdownDisplayProvider>
                <Card
                  {...defaultCardProps}
                  title="LLM Input"
                  extra={
                    <Flex direction="row" gap="size-100">
                      <ConnectedMarkdownModeSelect />
                      <CopyToClipboardButton text={input.value} />
                    </Flex>
                  }
                >
                  <MimeTypeCodeBlock {...input} />
                </Card>
              </MarkdownDisplayProvider>
            </View>
          </LazyTabPanel>
        )}

        {hasPromptTemplateObject && (
          <LazyTabPanel id="prompt-template">
            <LLMPromptTemplate promptTemplate={promptTemplate} />
          </LazyTabPanel>
        )}

        {hasPrompts && (
          <LazyTabPanel id="prompts">
            <LLMPromptsList prompts={prompts} />
          </LazyTabPanel>
        )}

        {hasInvocationParams && (
          <LazyTabPanel id="invocation-params">
            <CopyToClipboardWrap text={invocationParameters} padding="size-100">
              <ReadonlyJSONBlock>{invocationParameters}</ReadonlyJSONBlock>
            </CopyToClipboardWrap>
          </LazyTabPanel>
        )}
      </Tabs>
    </Card>
  );
}
