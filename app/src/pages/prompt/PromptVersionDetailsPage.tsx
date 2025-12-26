import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import {
  CopyToClipboardButton,
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
import { PromptModelConfigurationCard } from "@phoenix/pages/prompt/PromptModelConfigurationCard";
import { promptVersionLoader } from "@phoenix/pages/prompt/promptVersionLoader";

import { promptVersionLoaderQuery$data } from "./__generated__/promptVersionLoaderQuery.graphql";
import { PromptChatMessagesCard } from "./PromptChatMessagesCard";
import { PromptCodeExportCard } from "./PromptCodeExportCard";
import { PromptVersionTagsList } from "./PromptVersionTagsList";
import { TagPromptVersionButton } from "./TagPromptVersionButton";

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
            <Flex direction="row" gap="size-100">
              <Heading level={2}>
                Version:&nbsp;
                <span
                  css={css`
                    user-select: all;
                  `}
                >
                  {promptVersion.id}
                </span>
              </Heading>
              <PromptVersionTagsList promptVersion={promptVersion} />
            </Flex>
            <Flex direction="row" gap="size-100">
              <CopyToClipboardButton text={promptVersion.id}>
                Version ID
              </CopyToClipboardButton>
              <TagPromptVersionButton />
              <TooltipTrigger delay={0}>
                <TriggerWrap>
                  <LinkButton
                    variant="primary"
                    leadingVisual={<Icon svg={<Icons.PlayCircleOutline />} />}
                    to="playground"
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
