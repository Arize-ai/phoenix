import React from "react";
import { useLoaderData } from "react-router";

import {
  CopyToClipboardButton,
  Flex,
  Heading,
  View,
} from "@phoenix/components";
import { PromptModelConfigurationCard } from "@phoenix/pages/prompt/PromptModelConfigurationCard";

import { promptVersionLoaderQuery$data } from "./__generated__/promptVersionLoaderQuery.graphql";
import { PromptChatMessagesCard } from "./PromptChatMessagesCard";
import { PromptCodeExportCard } from "./PromptCodeExportCard";
import { PromptVersionTagsList } from "./PromptVersionTagsList";
import { TagPromptVersionButton } from "./TagPromptVersionButton";

export function PromptVersionDetailsPage() {
  const { promptVersion } = useLoaderData() as promptVersionLoaderQuery$data;
  return <PromptVersionDetailsPageContent promptVersion={promptVersion} />;
}

function PromptVersionDetailsPageContent({
  promptVersion,
}: {
  promptVersion: promptVersionLoaderQuery$data["promptVersion"];
}) {
  return (
    <View width="100%" overflow="auto" elementType="section">
      <View
        paddingX="size-200"
        paddingY="size-100"
        borderBottomColor="dark"
        borderBottomWidth="thin"
      >
        <Flex direction="row" justifyContent="space-between">
          <Flex direction="row" gap="size-100">
            <Heading level={2}>{`Version: ${promptVersion.id}`}</Heading>
            <PromptVersionTagsList promptVersion={promptVersion} />
          </Flex>
          <Flex direction="row" gap="size-100">
            <CopyToClipboardButton text={promptVersion.id}>
              Version ID
            </CopyToClipboardButton>
            <TagPromptVersionButton />
          </Flex>
        </Flex>
      </View>
      <View padding="size-200" width="100%" overflow="auto">
        <Flex
          direction="column"
          gap="size-200"
          maxWidth={900}
          marginStart="auto"
          marginEnd="auto"
        >
          <PromptChatMessagesCard promptVersion={promptVersion} />
          <PromptModelConfigurationCard promptVersion={promptVersion} />
          <PromptCodeExportCard promptVersion={promptVersion} />
        </Flex>
      </View>
    </View>
  );
}