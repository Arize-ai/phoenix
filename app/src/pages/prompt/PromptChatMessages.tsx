import React, { useMemo } from "react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Flex, Text } from "@arizeai/components";

import { TemplateLanguages } from "@phoenix/components/templateEditor/constants";
import { TemplateLanguage } from "@phoenix/components/templateEditor/types";

import {
  PromptChatMessages__main$key,
  PromptTemplateFormat,
} from "./__generated__/PromptChatMessages__main.graphql";
import { ChatTemplateMessage } from "./ChatTemplateMessage";
import { PromptChatTemplate, PromptChatTemplateSchema } from "./schemas";

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
  const { template, templateType, templateFormat } = useFragment(
    graphql`
      fragment PromptChatMessages__main on PromptVersion {
        template
        templateType
        templateFormat
      }
    `,
    promptVersion
  );

  if (templateType === "STRING") {
    return <Text>{template}</Text>;
  }

  return (
    <ChatMessages
      template={template}
      templateFormat={convertTemplateFormat(templateFormat)}
    />
  );
}

function ChatMessages({
  template,
  templateFormat,
}: {
  template: PromptChatTemplate | unknown;
  templateFormat: TemplateLanguage;
}) {
  const messages = useMemo(() => {
    const parsedTemplate = PromptChatTemplateSchema.safeParse(template);
    if (!parsedTemplate.success) {
      return [];
    }
    return parsedTemplate.data.messages;
  }, [template]);
  return (
    <Flex direction="column" gap="size-200">
      {messages.map((message, i) => (
        <ChatTemplateMessage
          key={i}
          {...message}
          templateFormat={templateFormat}
        />
      ))}
    </Flex>
  );
}
