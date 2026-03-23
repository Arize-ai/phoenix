import { useState } from "react";
import { usePreloadedQuery } from "react-relay";
import { useLoaderData, useParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Card,
  Flex,
  Icon,
  Icons,
  LinkButton,
  Switch,
  TitleWithID,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@phoenix/components";
import { PromptChatMessages } from "@phoenix/components/prompt/PromptChatMessagesCard";
import { PromptModelConfigurationCard } from "@phoenix/pages/prompt/PromptModelConfigurationCard";
import type { PromptVersionLoaderData } from "@phoenix/pages/prompt/promptVersionLoader";
import { promptVersionLoaderQuery } from "@phoenix/pages/prompt/promptVersionLoader";

import { TagPromptVersionButton } from "../../components/prompt/TagPromptVersionButton";
import type {
  promptVersionLoaderQuery as PromptVersionLoaderQuery,
  promptVersionLoaderQuery$data,
} from "./__generated__/promptVersionLoaderQuery.graphql";
import { PromptCodeExportCard } from "./PromptCodeExportCard";
import { PromptVersionDiffView } from "./PromptVersionDiffView";
import { PromptVersionTagsList } from "./PromptVersionTagsList";

export function PromptVersionDetailsPage() {
  const loaderData = useLoaderData<PromptVersionLoaderData>();
  const data = usePreloadedQuery<PromptVersionLoaderQuery>(
    promptVersionLoaderQuery,
    loaderData.queryRef
  );
  return <PromptVersionDetailsPageContent promptVersion={data.promptVersion} />;
}

function PromptVersionDetailsPageContent({
  promptVersion,
}: {
  promptVersion: promptVersionLoaderQuery$data["promptVersion"];
}) {
  const { promptId } = useParams();
  invariant(promptId, "promptId is required");
  const [showDiff, setShowDiff] = useState(false);
  const previousVersion = promptVersion.previousVersion;
  const hasPreviousVersion = previousVersion != null;
  return (
    <View width="100%" overflow="auto" elementType="section">
      <View padding="size-200" width="100%" overflow="auto">
        <Flex
          direction="column"
          gap="size-200"
          maxWidth={900}
          marginStart="auto"
          marginEnd="auto"
        >
          <Flex direction="row" justifyContent="space-between">
            <Flex direction="row" gap="size-100" alignItems="center">
              <TitleWithID title="Version" id={promptVersion.id} />
              <PromptVersionTagsList promptVersion={promptVersion} />
            </Flex>
            <Flex direction="row" gap="size-100">
              <TagPromptVersionButton
                promptId={promptId}
                versionId={promptVersion.id}
              />
              <TooltipTrigger delay={0}>
                <TriggerWrap>
                  <LinkButton
                    variant="primary"
                    leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
                    to={`/playground?promptId=${encodeURIComponent(promptId)}&promptVersionId=${encodeURIComponent(promptVersion.id)}`}
                    size="S"
                    data-testid="open-prompt-version-in-playground-button"
                    aria-label="Open this Prompt version in Playground"
                  >
                    Playground
                  </LinkButton>
                </TriggerWrap>
                <Tooltip>
                  <TooltipArrow />
                  Open this Prompt version in Playground
                </Tooltip>
              </TooltipTrigger>
            </Flex>
          </Flex>
          <Card
            title="Prompt"
            collapsible
            data-testid="prompt-chat-messages-card"
            extra={
              <Switch
                labelPlacement="start"
                isSelected={showDiff}
                isDisabled={!hasPreviousVersion}
                onChange={setShowDiff}
              >
                Diff
              </Switch>
            }
          >
            {showDiff && previousVersion ? (
              <PromptVersionDiffView
                current={promptVersion}
                previous={previousVersion}
              />
            ) : (
              <View padding="size-200">
                <PromptChatMessages promptVersion={promptVersion} />
              </View>
            )}
          </Card>
          <PromptModelConfigurationCard promptVersion={promptVersion} />
          <PromptCodeExportCard promptVersion={promptVersion} />
        </Flex>
      </View>
    </View>
  );
}
