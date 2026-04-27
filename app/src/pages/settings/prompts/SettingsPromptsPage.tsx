import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { SettingsPromptsPageLoaderType } from "@phoenix/pages/settings/prompts/settingsPromptsPageLoader";
import { settingsPromptsPageLoaderGql } from "@phoenix/pages/settings/prompts/settingsPromptsPageLoader";

import { PromptLabelsSettingsCard } from "./PromptLabelsSettingsCard";

export function SettingsPromptsPage() {
  const loaderData = useLoaderData<SettingsPromptsPageLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = useOwnedPreloadedQuery({
    query: settingsPromptsPageLoaderGql,
    queryRef: loaderData,
  });
  return (
    <main>
      <PromptLabelsSettingsCard query={data} />
    </main>
  );
}
