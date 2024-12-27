import React from "react";
import { useLoaderData } from "react-router";

import { Accordion, AccordionItem, Card } from "@arizeai/components";

import { Flex, View } from "@phoenix/components";

import { promptVersionLoaderQuery$data } from "./__generated__/promptVersionLoaderQuery.graphql";
import { PromptChatMessages } from "./PromptChatMessages";
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
    <View padding="size-200" width="100%">
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
          <Accordion size="M">
            <AccordionItem
              title="Invocation Parameters"
              id="invocation-parameters"
            >
              <PromptInvocationParameters promptVersion={promptVersion} />
            </AccordionItem>
          </Accordion>
        </Card>
      </Flex>
    </View>
  );
}
