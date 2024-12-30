import React from "react";
import { Heading } from "react-aria-components";
import { graphql, useFragment } from "react-relay";

import { Accordion, AccordionItem, Card } from "@arizeai/components";

import { Flex, View } from "@phoenix/components";

import { PromptIndexPage__aside$key } from "./__generated__/PromptIndexPage__aside.graphql";
import { PromptIndexPage__main$key } from "./__generated__/PromptIndexPage__main.graphql";
import { PromptChatMessages } from "./PromptChatMessages";
import { PromptCodeExportCard } from "./PromptCodeExportCard";
import { PromptInvocationParameters } from "./PromptInvocationParameters";
import { PromptLatestVersionsList } from "./PromptLatestVersionsList";
import { usePromptIdLoader } from "./usePromptIdLoader";

export function PromptIndexPage() {
  const loaderData = usePromptIdLoader();
  return <PromptIndexPageContent prompt={loaderData.prompt} />;
}

export function PromptIndexPageContent({
  prompt,
}: {
  prompt: PromptIndexPage__main$key;
}) {
  const data = useFragment<PromptIndexPage__main$key>(
    graphql`
      fragment PromptIndexPage__main on Prompt {
        promptVersions {
          edges {
            node {
              ...PromptInvocationParameters__main
              ...PromptChatMessages__main
              ...PromptCodeExportCard__main
            }
          }
        }
        ...PromptIndexPage__aside
      }
    `,
    prompt
  );

  const latestVersion = data?.promptVersions?.edges?.[0]?.node;

  return (
    <Flex direction="row" height="100%">
      <View
        height="100%"
        overflow="auto"
        width="100%"
        data-testid="scroll-container"
      >
        <View padding="size-200">
          <Flex
            direction="column"
            gap="size-200"
            marginStart="auto"
            marginEnd="auto"
            maxWidth={900}
          >
            <Card title="Prompt Template" variant="compact">
              <PromptChatMessages promptVersion={latestVersion} />
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
                  <PromptInvocationParameters promptVersion={latestVersion} />
                </AccordionItem>
                <AccordionItem title="Tools" id="model-tools">
                  <View padding="size-200">No Tools Specified</View>
                </AccordionItem>
              </Accordion>
            </Card>
            <PromptCodeExportCard promptVersion={latestVersion} />
          </Flex>
        </View>
      </View>
      <PromptIndexPageAside prompt={data} />
    </Flex>
  );
}

/**
 * The aside content for the prompt details. Displays the description,
 * tags, and history
 */
function PromptIndexPageAside({
  prompt,
}: {
  prompt: PromptIndexPage__aside$key;
}) {
  const data = useFragment(
    graphql`
      fragment PromptIndexPage__aside on Prompt {
        description
        ...PromptLatestVersionsListFragment
      }
    `,
    prompt
  );
  return (
    <View
      flex="none"
      width={400}
      borderStartColor="dark"
      borderStartWidth="thin"
    >
      <View paddingStart="size-200" paddingEnd="size-200">
        <Heading level={3}>Description</Heading>
        {/* TODO: Add a markdown view here */}
        <p>{data.description || "No description"}</p>
        <section>
          <Heading level={3}>Latest Versions</Heading>
          <PromptLatestVersionsList prompt={data} />
        </section>
      </View>
    </View>
  );
}
