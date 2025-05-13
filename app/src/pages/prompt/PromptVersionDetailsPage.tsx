import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import {
  CopyToClipboardButton,
  Flex,
  Heading,
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
              <Heading level={2}>{`Version: ${promptVersion.id}`}</Heading>
              <PromptVersionTagsList promptVersion={promptVersion} />
            </Flex>
            <Flex direction="row" gap="size-100">
              <CopyToClipboardButton text={promptVersion.id}>
                Version ID
              </CopyToClipboardButton>
              <TagPromptVersionButton />
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
