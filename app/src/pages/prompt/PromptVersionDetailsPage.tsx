import React from "react";
import { useLoaderData } from "react-router";

import { Card } from "@arizeai/components";

import {
  CopyToClipboardButton,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Heading,
  Tag,
  TagGroup,
  TagList,
  View,
} from "@phoenix/components";

import { promptVersionLoaderQuery$data } from "./__generated__/promptVersionLoaderQuery.graphql";
import { PromptChatMessages } from "./PromptChatMessages";
import { PromptCodeExportCard } from "./PromptCodeExportCard";
import { PromptInvocationParameters } from "./PromptInvocationParameters";
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
  const tags =
    promptVersion?.tags?.map((tag) => ({ id: tag.name, ...tag })) || [];
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
            <TagGroup aria-label="Prompt Version Tags">
              <TagList items={tags}>
                {(tag) => <Tag key={tag.name}>{tag.name}</Tag>}
              </TagList>
            </TagGroup>
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
          <Card title="Prompt" variant="compact">
            <PromptChatMessages promptVersion={promptVersion} />
          </Card>
          <Card
            title="Model Configuration"
            variant="compact"
            bodyStyle={{ padding: 0 }}
          >
            <DisclosureGroup defaultExpandedKeys={["invocation-parameters"]}>
              <Disclosure id="invocation-parameters">
                <DisclosureTrigger>Invocation Parameters</DisclosureTrigger>
                <DisclosurePanel>
                  <PromptInvocationParameters promptVersion={promptVersion} />
                </DisclosurePanel>
              </Disclosure>
            </DisclosureGroup>
          </Card>
          <PromptCodeExportCard promptVersion={promptVersion} />
        </Flex>
      </View>
    </View>
  );
}
