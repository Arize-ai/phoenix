import React from "react";
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
    <View padding="size-200" width="100%" overflow="auto">
      <Flex
        direction="column"
        gap="size-200"
        maxWidth={900}
        marginStart="auto"
        marginEnd="auto"
      >
        <Card title="Prompt">
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
  );
}
