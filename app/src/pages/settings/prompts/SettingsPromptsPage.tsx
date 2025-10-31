import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import {
  settingsPromptsPageLoaderGql,
  SettingsPromptsPageLoaderType,
} from "@phoenix/pages/settings/prompts/settingsPromptsPageLoader";

import { PromptLabelsSettingsCard } from "./PromptLabelsSettingsCard";

export function SettingsPromptsPage() {
  const loaderData = useLoaderData<SettingsPromptsPageLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery(settingsPromptsPageLoaderGql, loaderData);
  return (
    <main>
      <PromptLabelsSettingsCard query={data} />
    </main>
  );
}
