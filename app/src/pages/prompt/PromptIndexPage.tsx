import { DialogTrigger, Heading } from "react-aria-components";
import { graphql, useFragment } from "react-relay";

import {
  Button,
  Flex,
  Icon,
  Icons,
  LinkButton,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { ClonePromptDialog } from "@phoenix/pages/prompt/ClonePromptDialog";
import { PromptLabelConfigButton } from "@phoenix/pages/prompt/PromptLabelConfigButton";
import { PromptLabels } from "@phoenix/pages/prompt/PromptLabels";
import { PromptModelConfigurationCard } from "@phoenix/pages/prompt/PromptModelConfigurationCard";

import { PromptIndexPage__aside$key } from "./__generated__/PromptIndexPage__aside.graphql";
import { PromptIndexPage__main$key } from "./__generated__/PromptIndexPage__main.graphql";
import { EditPromptButton } from "./EditPromptButton";
import { PromptChatMessagesCard } from "./PromptChatMessagesCard";
import { PromptCodeExportCard } from "./PromptCodeExportCard";
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
              ...PromptChatMessagesCard__main
              ...PromptCodeExportCard__main
              ...PromptModelConfigurationCard__main
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
            <PromptChatMessagesCard
              title="Prompt Template"
              promptVersion={latestVersion}
            />
            <PromptModelConfigurationCard promptVersion={latestVersion} />
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
        id
        name
        description
        metadata
        ...PromptLatestVersionsListFragment
        ...EditPromptButton_data
        ...PromptLabels
      }
    `,
    prompt
  );
  const hasDescription = Boolean(data?.description);
  return (
    <View
      flex="none"
      width={400}
      borderStartColor="dark"
      borderStartWidth="thin"
    >
      <View padding="size-200">
        <Flex direction="row" gap="size-100" justifyContent="end">
          <DialogTrigger>
            <Button
              size="S"
              leadingVisual={<Icon svg={<Icons.DuplicateIcon />} />}
            >
              Clone
            </Button>
            <ModalOverlay>
              <Modal size="M">
                <ClonePromptDialog
                  promptId={data.id}
                  promptName={data.name}
                  promptDescription={data.description ?? undefined}
                  promptMetadata={data.metadata ?? undefined}
                />
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
          <LinkButton
            variant="primary"
            leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
            to="playground"
            size="S"
            aria-label="Open this Prompt in Playground"
          >
            Playground
          </LinkButton>
        </Flex>
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Heading level={3}>Description</Heading>
          <EditPromptButton prompt={data} />
        </Flex>
        {/* TODO: Add a markdown view here */}
        <Text color={hasDescription ? "text-900" : "text-700"}>
          {data.description || "No Description"}
        </Text>
        <section>
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Heading level={3}>Labels</Heading>
            <PromptLabelConfigButton promptId={data.id} />
          </Flex>
          <PromptLabels prompt={data} />
        </section>
        <section>
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Heading level={3}>Metadata</Heading>
            <EditPromptButton prompt={data} />
          </Flex>
          <JSONBlock
            value={
              data.metadata ? JSON.stringify(data.metadata, null, 2) : "{}"
            }
          />
        </section>
        <section>
          <Heading level={3}>Latest Versions</Heading>
          <PromptLatestVersionsList prompt={data} />
        </section>
      </View>
    </View>
  );
}
