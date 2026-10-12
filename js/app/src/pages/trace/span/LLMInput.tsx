import type { ReactNode } from "react";

import {
  Card,
  CardCollapsedPreview,
  CopyToClipboardButton,
  Flex,
} from "@phoenix/components";
import { inlineDividerCSS } from "@phoenix/components/core/styles";
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

import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { defaultCardProps } from "./constants";
import { LLMInvocationParams } from "./LLMInvocationParams";
import type { LLMIOView } from "./LLMIOViewSelect";
import { LLMIOViewSelect, useLLMIOView } from "./LLMIOViewSelect";
import { LLMMessagesCollapseToggle } from "./LLMMessagesCollapseToggle";
import { LLMMessagesList } from "./LLMMessagesList";
import { LLMPromptsList } from "./LLMPromptsList";
import { LLMPromptTemplate } from "./LLMPromptTemplate";
import { LLMToolSchemasList } from "./LLMToolSchemasList";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";
import type { SpanIOValue } from "./types";
import type { LLMToolDefinition } from "./utils";
import {
  formatJSONForCopy,
  formatJSONStringsForCopy,
  formatTextListForCopy,
  getPromptTemplatePreview,
} from "./utils";

/**
 * The input side of an LLM span — the model card with a view select for
 * messages, tools, raw input, and prompts. The prompt template and invocation
 * parameters render as collapsed cards at the top of the input messages.
 */
function getLLMInputSubtitle({
  modelName,
  provider,
  toolCount,
}: {
  modelName: string | null;
  provider: string | null;
  toolCount: number;
}): ReactNode {
  if (modelName == null && toolCount === 0) return null;
  const normalizedProvider = provider?.toUpperCase();
  const providerIcon =
    modelName != null &&
    typeof normalizedProvider === "string" &&
    isModelProvider(normalizedProvider) ? (
      <GenerativeProviderIcon provider={normalizedProvider} height={16} />
    ) : null;
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      {providerIcon}
      {modelName}
      {modelName != null && toolCount > 0 ? (
        <span aria-hidden css={inlineDividerCSS} />
      ) : null}
      {toolCount > 0
        ? `${toolCount} ${toolCount === 1 ? "tool" : "tools"}`
        : null}
    </Flex>
  );
}

function getLLMInputViews({
  hasInput,
  hasInputMessages,
  hasToolSchemas,
  hasPrompts,
}: {
  hasInput: boolean;
  hasInputMessages: boolean;
  hasToolSchemas: boolean;
  hasPrompts: boolean;
}): LLMIOView[] {
  const views: LLMIOView[] = [];
  if (hasInputMessages) views.push({ id: "input-messages", label: "Messages" });
  if (hasToolSchemas) views.push({ id: "tools", label: "Tools" });
  if (hasInput) views.push({ id: "input", label: "Raw" });
  if (hasPrompts) views.push({ id: "prompts", label: "Prompts" });
  return views;
}

function getLLMInputCopyText({
  view,
  input,
  inputMessages,
  tools,
  prompts,
}: {
  view: LLMIOView["id"] | null | undefined;
  input: SpanIOValue | null;
  inputMessages: AttributeMessage[];
  tools: LLMToolDefinition[];
  prompts: string[];
}): string | null {
  switch (view) {
    case "input-messages":
      return formatJSONForCopy(inputMessages);
    case "tools":
      return formatJSONStringsForCopy(tools.map((tool) => tool.jsonSchema));
    case "input":
      return input?.value ?? null;
    case "prompts":
      return formatTextListForCopy(prompts);
    default:
      return null;
  }
}

export function LLMInput({
  modelName,
  provider,
  input,
  inputMessages,
  tools,
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
  /** The tools available to the LLM */
  tools: LLMToolDefinition[];
  promptTemplate: AttributePromptTemplate | null;
  prompts: string[];
  /** The invocation parameters as a JSON string */
  invocationParameters: string;
}) {
  const toolCount = tools.length;
  const subTitleEl = getLLMInputSubtitle({ modelName, provider, toolCount });

  const hasInput = input != null && input.value != null;
  const hasInputMessages = inputMessages.length > 0;
  const hasLLMToolSchemas = toolCount > 0;
  const hasPrompts = prompts.length > 0;
  const hasInvocationParams =
    Object.keys(safelyParseJSON(invocationParameters).json || {}).length > 0;

  const views = getLLMInputViews({
    hasInput,
    hasInputMessages,
    hasToolSchemas: hasLLMToolSchemas,
    hasPrompts,
  });
  const { view, setView } = useLLMIOView(views);

  // Collapsed cards shown above the input messages (input-only context)
  const messageLeadingItems = [
    promptTemplate != null && (
      <Card
        key="prompt-template"
        {...defaultCardProps}
        defaultOpen={false}
        title="Prompt Template"
        headerContent={
          <CardCollapsedPreview>
            {getPromptTemplatePreview(promptTemplate)}
          </CardCollapsedPreview>
        }
        extra={
          <CopyToClipboardButton text={formatJSONForCopy(promptTemplate)} />
        }
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

  const isRawView = view === "input" && hasInput;
  const cardProps = useSpanInfoCardProps("input");

  // Whatever the card is showing is what its copy button copies, so the reader
  // never has to switch views to get at the content in front of them
  const copyText = getLLMInputCopyText({
    view,
    input,
    inputMessages,
    tools,
    prompts,
  });

  return (
    <MarkdownDisplayProvider>
      <Card
        {...defaultCardProps}
        {...cardProps}
        title="Input"
        subTitle={subTitleEl}
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            {isRawView && <ConnectedMarkdownModeSelect />}
            {view === "input-messages" && (
              <LLMMessagesCollapseToggle scope="input" />
            )}
            {views.length > 0 && (
              <LLMIOViewSelect
                label="Input view"
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
        {view === "input-messages" && (
          <LLMMessagesList
            messages={inputMessages}
            leadingItems={messageLeadingItems}
          />
        )}
        {view === "tools" && <LLMToolSchemasList tools={tools} />}
        {isRawView && <MimeTypeCodeBlock {...input} />}
        {view === "prompts" && <LLMPromptsList prompts={prompts} />}
      </Card>
    </MarkdownDisplayProvider>
  );
}
