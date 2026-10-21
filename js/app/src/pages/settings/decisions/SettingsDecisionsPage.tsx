import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { settingsDecisionsPageLoaderQuery } from "@phoenix/pages/settings/decisions/__generated__/settingsDecisionsPageLoaderQuery.graphql";
import type { SettingsDecisionsPageLoaderType } from "@phoenix/pages/settings/decisions/settingsDecisionsPageLoader";
import { settingsDecisionsPageLoaderGql } from "@phoenix/pages/settings/decisions/settingsDecisionsPageLoader";

import { DecisionLabelsSettingsCard } from "./DecisionLabelsSettingsCard";

export function SettingsDecisionsPage() {
  const loaderData = useLoaderData<SettingsDecisionsPageLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = useOwnedPreloadedQuery<settingsDecisionsPageLoaderQuery>({
    query: settingsDecisionsPageLoaderGql,
    queryRef: loaderData,
  });
  return (
    <main>
      <DecisionLabelsSettingsCard query={data} />
    </main>
  );
}
