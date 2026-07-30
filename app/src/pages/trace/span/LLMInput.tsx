import type { ReactNode } from "react";

import { Card, CopyToClipboardButton, Flex, Text } from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative";
import {
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import type { AttributeMessage } from "@phoenix/openInference/tracing/types";
import { isModelProvider } from "@phoenix/utils/generativeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import { SpanDetailsDisclosureSection } from "../SpanDetailsDisclosureSection";
import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { defaultCardProps } from "./constants";
import { LLMInvocationParams } from "./LLMInvocationParams";
import type { LLMIOView } from "./LLMIOViewSelect";
import { LLMIOViewSelect, useLLMIOView } from "./LLMIOViewSelect";
import { LLMMessagesList } from "./LLMMessagesList";
import { LLMPromptsList } from "./LLMPromptsList";
import { LLMPromptTemplate } from "./LLMPromptTemplate";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";
import type {
  SpanInfoSectionProps,
  SpanIOValue,
  SpanPromptTemplate,
} from "./types";
import { formatJSONForCopy, formatTextListForCopy } from "./utils";

/**
 * The input side of an LLM span — a top-level section with a view select for
 * messages, raw input, and prompts. Tool definitions have their own top-level
 * section. The prompt template and invocation
 * parameters render as collapsed cards at the top of the input messages.
 */
export function LLMInput({
  modelName,
  provider,
  input,
  inputMessages,
  promptTemplate,
  prompts,
  invocationParameters,
  sectionId,
  bordered,
}: {
  /** The name of the model that was invoked */
  modelName: string | null;
  /** The model provider (e.g. openai) used to pick the provider icon */
  provider: string | null;
  /** The raw input value of the span */
  input: SpanIOValue | null;
  inputMessages: AttributeMessage[];
  promptTemplate: SpanPromptTemplate | null;
  prompts: string[];
  /** The invocation parameters as a JSON string */
  invocationParameters: string;
} & SpanInfoSectionProps) {
  let subTitleEl: ReactNode = null;
  if (modelName != null) {
    const normalizedProvider = provider?.toUpperCase();
    // Only show a provider icon when the provider is known
    const providerIcon =
      modelName != null &&
      typeof normalizedProvider === "string" &&
      isModelProvider(normalizedProvider) ? (
        <GenerativeProviderIcon provider={normalizedProvider} height={16} />
      ) : null;
    subTitleEl = (
      <Flex direction="row" gap="size-100" alignItems="center">
        {providerIcon}
        <Text color="text-700">{modelName}</Text>
      </Flex>
    );
  }

  const hasInput = input != null && input.value != null;
  const hasInputMessages = inputMessages.length > 0;
  const hasPrompts = prompts.length > 0;
  const hasInvocationParams =
    Object.keys(safelyParseJSON(invocationParameters).json || {}).length > 0;

  const views: LLMIOView[] = [];
  if (hasInputMessages) views.push({ id: "input-messages", label: "Messages" });
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
  let copyText: string | null = null;
  switch (view) {
    case "input-messages":
      copyText = formatJSONForCopy(inputMessages);
      break;
    case "input":
      copyText = input?.value ?? null;
      break;
    case "prompts":
      copyText = formatTextListForCopy(prompts);
      break;
  }

  return (
    <MarkdownDisplayProvider>
      <SpanDetailsDisclosureSection
        sectionId={sectionId}
        bordered={bordered}
        {...cardProps}
        title="Input"
        titleExtra={subTitleEl}
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            {isRawView && <ConnectedMarkdownModeSelect />}
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
        {isRawView && <MimeTypeCodeBlock {...input} initializeImmediately />}
        {view === "prompts" && <LLMPromptsList prompts={prompts} />}
      </SpanDetailsDisclosureSection>
    </MarkdownDisplayProvider>
  );
}
