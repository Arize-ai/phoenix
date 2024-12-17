import React, { useState } from "react";
import { Heading } from "react-aria-components";
import { graphql, useFragment } from "react-relay";

import { Card, Flex, View } from "@arizeai/components";

import {
  CodeLanguage,
  CodeLanguageRadioGroup,
  PythonBlock,
} from "@phoenix/components/code";

import { PromptTabContent__aside$key } from "./__generated__/PromptTabContent__aside.graphql";
import { PromptTabContent__main$key } from "./__generated__/PromptTabContent__main.graphql";
import { ChatTemplateMessage } from "./ChatTemplateMessage";

export function PromptTabContent({
  prompt,
}: {
  prompt: PromptTabContent__main$key;
}) {
  const [language, setLanguage] = useState<CodeLanguage>("Python");
  const data = useFragment(
    graphql`
      fragment PromptTabContent__main on Prompt {
        ...PromptTabContent__aside
      }
    `,
    prompt
  );
  return (
    <Flex direction="row" height="100%">
      <View flex="1 1 auto" padding="size-200">
        <Flex
          direction="column"
          gap="size-200"
          maxWidth={900}
          marginStart="auto"
          marginEnd="auto"
        >
          <Card title="Prompt Template" variant="compact">
            <Flex direction="column" gap="size-100">
              <ChatTemplateMessage role="system" content="System message" />
              <ChatTemplateMessage role="user" content="User message" />
            </Flex>
          </Card>
          <Card title="Model Configuration" variant="compact">
            <View padding="lg">model configuration</View>
          </Card>
          <Card
            title="Code"
            variant="compact"
            extra={
              <CodeLanguageRadioGroup
                language={language}
                onChange={setLanguage}
              />
            }
          >
            <PythonBlock value="Hello world" />
          </Card>
        </Flex>
      </View>
      <PromptTabContentAside prompt={data} />
    </Flex>
  );
}

/**
 * The aside content for the prompt details. Displays the description,
 * tags, and history
 */
function PromptTabContentAside({
  prompt,
}: {
  prompt: PromptTabContent__aside$key;
}) {
  const data = useFragment(
    graphql`
      fragment PromptTabContent__aside on Prompt {
        description
      }
    `,
    prompt
  );
  return (
    <View
      flex="none"
      width="400px"
      borderStartColor="dark"
      borderStartWidth="thin"
    >
      <View paddingStart="size-200" paddingEnd="size-200">
        <Heading level={3}>Description</Heading>
        {/* TODO: Add a markdown view here */}
        <p>{data.description || "No description"}</p>
        {/* TODO: Add a history view here */}
      </View>
    </View>
  );
}
