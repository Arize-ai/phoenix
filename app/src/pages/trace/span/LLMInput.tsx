import type { ReactNode } from "react";

import { Card, CopyToClipboardButton, Flex, View } from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative";
import {
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import type {
  AttributeMessage,
  AttributePromptTemplate,
} from "@phoenix/openInference/tracing/types";
import { isModelProvider } from "@phoenix/utils/generativeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { defaultCardProps } from "./constants";
import { LLMInvocationParams } from "./LLMInvocationParams";
import type { LLMIOView } from "./LLMIOViewSelect";
import { LLMIOViewSelect, useLLMIOView } from "./LLMIOViewSelect";
import { LLMMessagesList } from "./LLMMessagesList";
import { LLMPromptsList } from "./LLMPromptsList";
import { LLMPromptTemplate } from "./LLMPromptTemplate";
import { LLMToolSchemasList } from "./LLMToolSchemasList";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";
import type { SpanIOValue } from "./types";

/**
 * The input side of an LLM span — the model card with a view select for
 * messages, tools, raw input, and prompts. The prompt template and invocation
 * parameters render as collapsed cards at the top of the input messages.
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
  let modelNameEl: ReactNode = null;
  if (modelName != null) {
    const normalizedProvider = provider?.toUpperCase();
    // Only show a provider icon when the provider is known
    const providerIcon =
      typeof normalizedProvider === "string" &&
      isModelProvider(normalizedProvider) ? (
        <GenerativeProviderIcon provider={normalizedProvider} height={16} />
      ) : null;
    modelNameEl = (
      <Flex direction="row" gap="size-100" alignItems="center">
        {providerIcon}
        {modelName}
      </Flex>
    );
  }

  const hasInput = input != null && input.value != null;
  const hasInputMessages = inputMessages.length > 0;
  const hasLLMToolSchemas = toolSchemas.length > 0;
  const hasPrompts = prompts.length > 0;
  const hasInvocationParams =
    Object.keys(safelyParseJSON(invocationParameters).json || {}).length > 0;

  const views: LLMIOView[] = [];
  if (hasInputMessages) views.push({ id: "input-messages", label: "Messages" });
  if (hasLLMToolSchemas) views.push({ id: "tools", label: "Tools" });
  if (hasInput) views.push({ id: "input", label: "Raw" });
  if (hasPrompts) views.push({ id: "prompts", label: "Prompts" });
  const { view, setView } = useLLMIOView(views);

  // Collapsed cards shown above the input messages (input-only context)
  const messageLeadingItems = [
    promptTemplate != null && (
      <Card
        key="prompt-template"
        {...defaultCardProps}
        defaultOpen={false}
        title="Prompt Template"
      >
        <LLMPromptTemplate promptTemplate={promptTemplate} />
      </Card>
    ),
    hasInvocationParams && (
      <LLMInvocationParams
        key="invocation-params"
        invocationParameters={invocationParameters}
      />
    ),
  ].filter(Boolean);

  return (
    <Card
      collapsible
      title="Input"
      subTitle={modelNameEl}
      extra={
        views.length > 0 ? (
          <LLMIOViewSelect
            label="Input view"
            views={views}
            value={view ?? ""}
            onChange={setView}
          />
        ) : undefined
      }
    >
      {view === "input-messages" && (
        <LLMMessagesList
          messages={inputMessages}
          leadingItems={messageLeadingItems}
        />
      )}
      {view === "tools" && <LLMToolSchemasList toolSchemas={toolSchemas} />}
      {view === "input" && hasInput && (
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
      )}
      {view === "prompts" && <LLMPromptsList prompts={prompts} />}
    </Card>
  );
}
