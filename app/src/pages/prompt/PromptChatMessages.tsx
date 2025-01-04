import React from "react";
import { graphql, useFragment } from "react-relay";

import { Flex, Text } from "@phoenix/components";
import { TemplateLanguages } from "@phoenix/components/templateEditor/constants";
import { TemplateLanguage } from "@phoenix/components/templateEditor/types";

import {
  PromptChatMessages__main$data,
  PromptChatMessages__main$key,
  PromptTemplateFormat,
} from "./__generated__/PromptChatMessages__main.graphql";
import { ChatTemplateMessage } from "./ChatTemplateMessage";

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
  promptVersion: PromptChatMessages__main$key;
}) {
  const { template, templateFormat } = useFragment(
    graphql`
      fragment PromptChatMessages__main on PromptVersion {
        template {
          __typename
          ... on PromptChatTemplate {
            messages {
              ... on JSONPromptMessage {
                role
                jsonContent: content
              }
              ... on TextPromptMessage {
                role
                content
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
      />
    );
  }
  if (template.__typename === "%other") {
    throw new Error("Unknown template type" + template.__typename);
  }
}

function ChatMessages({
  template,
  templateFormat,
}: {
  template: Extract<
    PromptChatMessages__main$data["template"],
    { __typename: "PromptChatTemplate" }
  >;
  templateFormat: TemplateLanguage;
}) {
  const { messages } = template;
  return (
    <Flex direction="column" gap="size-200">
      {messages.map((message, i) => (
        // TODO: Handle JSON content for things like tool calls
        <ChatTemplateMessage
          key={i}
          role={message.role as string}
          content={message.content || JSON.stringify(message.jsonContent)}
          templateFormat={templateFormat}
        />
      ))}
    </Flex>
  );
}
