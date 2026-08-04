import { graphql, useFragment } from "react-relay";

import { Card, Flex, Text, View } from "@phoenix/components";
import type {
  PromptChatMessagesCard__main$data,
  PromptChatMessagesCard__main$key,
} from "@phoenix/components/prompt/__generated__/PromptChatMessagesCard__main.graphql";
import {
  ChatTemplateMessageCard,
  ChatTemplateMessageTextPart,
  ChatTemplateMessageToolCallPart,
  ChatTemplateMessageToolResultPart,
} from "@phoenix/components/prompt/ChatTemplateMessageCard";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { DEFAULT_MODEL_PROVIDER } from "@phoenix/constants/generativeConstants";
import { openInferenceModelProviderToPhoenixModelProvider } from "@phoenix/pages/playground/playgroundUtils";
import type { AnyPart } from "@phoenix/schemas/promptSchemas";
import {
  toContentPreview,
  toPreviewLine,
  toToolCallsPreview,
} from "@phoenix/utils/contentPreviewUtils";
import {
  asTextPart,
  asToolCallPart,
  asToolResultPart,
} from "@phoenix/utils/promptUtils";

export function PromptChatMessages({
  promptVersion,
}: {
  promptVersion: PromptChatMessagesCard__main$key;
}) {
  const { template, templateFormat, provider } = useFragment(
    graphql`
      fragment PromptChatMessagesCard__main on PromptVersion {
        provider: modelProvider
        template {
          __typename
          ... on PromptChatTemplate {
            messages {
              role
              content {
                __typename
                ... on TextContentPart {
                  text {
                    text
                  }
                }
                ... on ToolCallContentPart {
                  toolCall {
                    toolCallId
                    toolCall {
                      arguments
                      name
                    }
                  }
                }
                ... on ToolResultContentPart {
                  toolResult {
                    toolCallId
                    result
                  }
                }
              }
            }
          }
          ... on PromptStringTemplate {
            template
          }
        }
        templateType
        templateFormat
      }
    `,
    promptVersion
  );

  if (template.__typename === "PromptStringTemplate") {
    return <Text>{template.template}</Text>;
  }
  if (template.__typename === "PromptChatTemplate") {
    return (
      <ChatMessages
        template={template}
        templateFormat={templateFormat}
        provider={
          openInferenceModelProviderToPhoenixModelProvider(provider) ||
          DEFAULT_MODEL_PROVIDER
        }
      />
    );
  }
  if (template.__typename === "%other") {
    throw new Error("Unknown template type" + template.__typename);
  }
  return null;
}

function ChatMessageContentPart({
  part,
  templateFormat,
  provider,
  isOnlyChild,
}: {
  part: Extract<
    PromptChatMessagesCard__main$data["template"],
    { __typename: "PromptChatTemplate" }
  >["messages"][number]["content"][number];
  templateFormat: TemplateFormat;
  provider: ModelProvider;
  isOnlyChild?: boolean;
}) {
  let parsedPart: AnyPart | null = asTextPart(part);
  if (parsedPart) {
    return (
      <ChatTemplateMessageTextPart
        text={parsedPart.text.text}
        templateFormat={templateFormat}
        isOnlyChild={isOnlyChild}
      />
    );
  }

  parsedPart = asToolCallPart(part);
  if (parsedPart) {
    return (
      <ChatTemplateMessageToolCallPart
        toolCall={parsedPart}
        provider={provider}
        isOnlyChild={isOnlyChild}
      />
    );
  }

  parsedPart = asToolResultPart(part);
  if (parsedPart) {
    return (
      <ChatTemplateMessageToolResultPart
        toolResult={parsedPart}
        isOnlyChild={isOnlyChild}
      />
    );
  }

  return null;
}

type ChatTemplateMessage = Extract<
  PromptChatMessagesCard__main$data["template"],
  { __typename: "PromptChatTemplate" }
>["messages"][number];

/**
 * A one-line excerpt of a template message for its card's collapsed header.
 * Prefers the message's text, then what it calls, then what a tool returned to
 * it — the same order the parts render in, so the preview is of what the reader
 * would see first on expanding the card.
 */
function getMessagePreview(message: ChatTemplateMessage): string | undefined {
  const text = message.content
    .map((part) => asTextPart(part)?.text.text)
    .filter(Boolean)
    .join(" ");
  const toolCalls = message.content
    .map((part) => asToolCallPart(part)?.toolCall.toolCall)
    .filter((toolCall) => toolCall != null);
  // Every result, not just the first: a message whose first result part is
  // blank still has something worth previewing in the ones after it
  const toolResults = message.content
    .map((part) => toPreviewLine(asToolResultPart(part)?.toolResult.result))
    .filter(Boolean)
    .join(" ");
  return (
    toContentPreview(text) ??
    toToolCallsPreview(toolCalls) ??
    toContentPreview(toolResults)
  );
}

function ChatMessages({
  template,
  templateFormat,
  provider,
}: {
  template: Extract<
    PromptChatMessagesCard__main$data["template"],
    { __typename: "PromptChatTemplate" }
  >;
  templateFormat: TemplateFormat;
  provider: ModelProvider;
}) {
  const { messages } = template;
  return (
    <Flex direction="column" gap="size-100" data-testid="chat-messages">
      {messages.map((message, i) => {
        const isOnlyChild =
          message.content.length === 1 &&
          message.content.find(asTextPart) != null;
        return (
          <ChatTemplateMessageCard
            key={i}
            role={message.role as string}
            preview={getMessagePreview(message)}
          >
            {message.content.map((content, i) => (
              <ChatMessageContentPart
                key={`${i}-${content.__typename}`}
                part={content}
                templateFormat={templateFormat}
                provider={provider}
                isOnlyChild={isOnlyChild}
              />
            ))}
          </ChatTemplateMessageCard>
        );
      })}
    </Flex>
  );
}

export function PromptChatMessagesCard({
  title = "Prompt",
  promptVersion,
}: {
  title?: string;
  promptVersion: PromptChatMessagesCard__main$key;
}) {
  return (
    <Card title={title} collapsible data-testid="prompt-chat-messages-card">
      <View padding="size-200">
        <PromptChatMessages promptVersion={promptVersion} />
      </View>
    </Card>
  );
}
