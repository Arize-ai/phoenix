import React from "react";
import { graphql, useFragment } from "react-relay";

import { Card } from "@arizeai/components";

import { Flex, Text } from "@phoenix/components";
import { TemplateLanguages } from "@phoenix/components/templateEditor/constants";
import { TemplateLanguage } from "@phoenix/components/templateEditor/types";
import { DEFAULT_MODEL_PROVIDER } from "@phoenix/constants/generativeConstants";
import { openInferenceModelProviderToPhoenixModelProvider } from "@phoenix/pages/playground/playgroundUtils";
import { AnyPart } from "@phoenix/schemas/promptSchemas";
import {
  asTextPart,
  asToolCallPart,
  asToolResultPart,
} from "@phoenix/utils/promptUtils";

import {
  PromptChatMessagesCard__main$data,
  PromptChatMessagesCard__main$key,
  PromptTemplateFormat,
} from "./__generated__/PromptChatMessagesCard__main.graphql";
import {
  ChatTemplateMessageCard,
  ChatTemplateMessageTextPart,
  ChatTemplateMessageToolCallPart,
  ChatTemplateMessageToolResultPart,
} from "./ChatTemplateMessageCard";

const convertTemplateFormat = (
  templateFormat: PromptTemplateFormat
): TemplateLanguage => {
  if (templateFormat === "FSTRING") {
    return TemplateLanguages.FString;
  } else if (templateFormat === "MUSTACHE") {
    return TemplateLanguages.Mustache;
  }
  return TemplateLanguages.NONE;
};

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
                ... on ImageContentPart {
                  image {
                    url
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
        templateFormat={convertTemplateFormat(templateFormat)}
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
  templateFormat: TemplateLanguage;
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

function ChatMessages({
  template,
  templateFormat,
  provider,
}: {
  template: Extract<
    PromptChatMessagesCard__main$data["template"],
    { __typename: "PromptChatTemplate" }
  >;
  templateFormat: TemplateLanguage;
  provider: ModelProvider;
}) {
  const { messages } = template;
  return (
    <Flex direction="column" gap="size-100">
      {messages.map((message, i) => {
        const isOnlyChild =
          message.content.length === 1 &&
          message.content.find(asTextPart) != null;
        return (
          <ChatTemplateMessageCard key={i} role={message.role as string}>
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
    <Card title={title} variant="compact">
      <PromptChatMessages promptVersion={promptVersion} />
    </Card>
  );
}