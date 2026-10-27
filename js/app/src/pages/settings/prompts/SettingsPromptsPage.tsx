import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import { DecisionLabelsSettingsCard } from "@phoenix/pages/settings/decisions/DecisionLabelsSettingsCard";
import type { settingsPromptsPageLoaderQuery } from "@phoenix/pages/settings/prompts/__generated__/settingsPromptsPageLoaderQuery.graphql";
import type { SettingsPromptsPageLoaderType } from "@phoenix/pages/settings/prompts/settingsPromptsPageLoader";
import { settingsPromptsPageLoaderGql } from "@phoenix/pages/settings/prompts/settingsPromptsPageLoader";

import { PromptLabelsSettingsCard } from "./PromptLabelsSettingsCard";

export function SettingsPromptsPage() {
  const loaderData = useLoaderData<SettingsPromptsPageLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery<settingsPromptsPageLoaderQuery>(
    settingsPromptsPageLoaderGql,
    loaderData
  );
  return (
    <main>
      <Flex direction="column" gap="size-200">
        <PromptLabelsSettingsCard query={data} />
        <DecisionLabelsSettingsCard query={data} />
      </Flex>
    </main>
  );
}
