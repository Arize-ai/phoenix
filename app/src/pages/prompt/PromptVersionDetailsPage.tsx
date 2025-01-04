import React from "react";
import { Heading } from "react-aria-components";
import { useLoaderData } from "react-router";

import { Card } from "@arizeai/components";

import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  View,
} from "@phoenix/components";

import { promptVersionLoaderQuery$data } from "./__generated__/promptVersionLoaderQuery.graphql";
import { PromptChatMessages } from "./PromptChatMessages";
import { PromptCodeExportCard } from "./PromptCodeExportCard";
import { PromptInvocationParameters } from "./PromptInvocationParameters";

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
          <Heading level={2}>{`Version: ${promptVersion.id}`}</Heading>
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
