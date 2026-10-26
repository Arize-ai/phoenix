import { graphql, useFragment, usePreloadedQuery } from "react-relay";

import { Flex } from "@phoenix/components";
import { PromptChatMessagesCard } from "@phoenix/components/prompt/PromptChatMessagesCard";
import { DecisionIndexPage } from "@phoenix/pages/decision/DecisionIndexPage";
import { PromptLabelConfigButton } from "@phoenix/pages/prompt/PromptLabelConfigButton";
import { PromptLabels } from "@phoenix/pages/prompt/PromptLabels";
import { PromptModelConfigurationCard } from "@phoenix/pages/prompt/PromptModelConfigurationCard";

import type { PromptIndexPage__aside$key } from "./__generated__/PromptIndexPage__aside.graphql";
import type { PromptIndexPage__main$key } from "./__generated__/PromptIndexPage__main.graphql";
import type { promptLoaderQuery as promptLoaderQueryType } from "./__generated__/promptLoaderQuery.graphql";
import { EditPromptButton } from "./EditPromptButton";
import { PromptCodeExportCard } from "./PromptCodeExportCard";
import {
  PromptDetailsAside,
  PromptDetailsMainColumn,
} from "./PromptDetailsAside";
import { PromptLatestVersionsList } from "./PromptLatestVersionsList";
import { promptLoaderQuery } from "./promptLoader";
import { PromptNotFound } from "./PromptNotFound";
import { usePromptIdLoader } from "./usePromptIdLoader";

export function PromptIndexPage() {
  const loaderData = usePromptIdLoader();
  const data = usePreloadedQuery<promptLoaderQueryType>(
    promptLoaderQuery,
    loaderData.queryRef
  );
  const node = data.prompt;
  switch (node.__typename) {
    case "Prompt":
      return <PromptIndexPageContent prompt={node} />;
    case "Decision":
      return <DecisionIndexPage decision={node} />;
    default:
      return <PromptNotFound />;
  }
}

function PromptIndexPageContent({
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
      <PromptDetailsMainColumn>
        <PromptChatMessagesCard
          title="Prompt Template"
          promptVersion={latestVersion}
        />
        <PromptModelConfigurationCard promptVersion={latestVersion} />
        <PromptCodeExportCard promptVersion={latestVersion} />
      </PromptDetailsMainColumn>
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
  return (
    <PromptDetailsAside
      description={data.description}
      metadata={data.metadata}
      editButton={<EditPromptButton prompt={data} />}
      labelConfigButton={<PromptLabelConfigButton promptId={data.id} />}
      labels={<PromptLabels prompt={data} />}
      latestVersions={<PromptLatestVersionsList prompt={data} />}
    />
  );
}
