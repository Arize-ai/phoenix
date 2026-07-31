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
import { ChatTemplateMessageMediaPart } from "@phoenix/components/prompt/media/ChatTemplateMessageMediaParts";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { DEFAULT_MODEL_PROVIDER } from "@phoenix/constants/generativeConstants";
import { openInferenceModelProviderToPhoenixModelProvider } from "@phoenix/pages/playground/playgroundUtils";
import type { AnyPart } from "@phoenix/schemas/promptSchemas";
import { flattenMediaContent } from "@phoenix/utils/mediaContentPartFragment";
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
                ...mediaContentPartFragment
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
  /**
   * A content part with its media read back — see `flattenMediaContent`. Typed as
   * `unknown` because every converter below takes `unknown` and discriminates.
   */
  part: unknown;
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

  const mediaPart = ChatTemplateMessageMediaPart({ part, isOnlyChild });
  if (mediaPart) {
    return mediaPart;
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
        // The media selection arrives as an `@inline` fragment, so it has to be read
        // back before the parts can be discriminated structurally.
        const content = flattenMediaContent(message.content);
        const isOnlyChild =
          content.length === 1 && content.find(asTextPart) != null;
        return (
          <ChatTemplateMessageCard key={i} role={message.role as string}>
            {content.map((part, i) => (
              <ChatMessageContentPart
                key={i}
                part={part}
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
