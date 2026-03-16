import { css } from "@emotion/react";
import { useLoaderData, useParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Flex,
  Heading,
  Icon,
  Icons,
  LinkButton,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@phoenix/components";
import { CopyButton } from "@phoenix/components/core/copy";
import { PromptChatMessagesCard } from "@phoenix/components/prompt/PromptChatMessagesCard";
import { PromptModelConfigurationCard } from "@phoenix/pages/prompt/PromptModelConfigurationCard";
import type { promptVersionLoader } from "@phoenix/pages/prompt/promptVersionLoader";

import { TagPromptVersionButton } from "../../components/prompt/TagPromptVersionButton";
import type { promptVersionLoaderQuery$data } from "./__generated__/promptVersionLoaderQuery.graphql";
import { PromptCodeExportCard } from "./PromptCodeExportCard";
import { PromptVersionTagsList } from "./PromptVersionTagsList";

const dialogTitleIdCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-static-size-50);

  .copy-button {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease-in-out;
  }

  &:hover .copy-button,
  .copy-button:focus-within {
    opacity: 1;
    pointer-events: auto;
  }
`;

const monoCSS = css`
  font-family: "Geist Mono", monospace;
  white-space: nowrap;
`;

export function PromptVersionDetailsPage() {
  const loaderData = useLoaderData<typeof promptVersionLoader>();
  invariant(loaderData, "loaderData is required");
  return (
    <PromptVersionDetailsPageContent promptVersion={loaderData.promptVersion} />
  );
}

function PromptVersionDetailsPageContent({
  promptVersion,
}: {
  promptVersion: promptVersionLoaderQuery$data["promptVersion"];
}) {
  const { promptId } = useParams();
  invariant(promptId, "promptId is required");
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
              <Heading level={2}>
                <span css={dialogTitleIdCSS}>
                  Version: <span css={monoCSS}>{promptVersion.id}</span>
                  <CopyButton
                    text={promptVersion.id}
                    variant="quiet"
                    size="S"
                  />
                </span>
              </Heading>
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
          <PromptChatMessagesCard promptVersion={promptVersion} />
          <PromptModelConfigurationCard promptVersion={promptVersion} />
          <PromptCodeExportCard promptVersion={promptVersion} />
        </Flex>
      </View>
    </View>
  );
}
