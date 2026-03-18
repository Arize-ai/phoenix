import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";

import { Flex } from "@phoenix/components";
import { CustomProvidersCard } from "@phoenix/pages/settings/CustomProvidersCard";
import { GenerativeProvidersCard } from "@phoenix/pages/settings/GenerativeProvidersCard";
import {
  settingsAIProvidersPageLoaderQuery,
  type SettingsAIProvidersLoaderData,
} from "@phoenix/pages/settings/settingsAIProvidersPageLoader";

import type { settingsAIProvidersPageLoaderQuery as SettingsAIProvidersPageLoaderQuery } from "./__generated__/settingsAIProvidersPageLoaderQuery.graphql";

export function SettingsAIProvidersPage() {
  const loaderData = useLoaderData<SettingsAIProvidersLoaderData>();
  const data = usePreloadedQuery<SettingsAIProvidersPageLoaderQuery>(
    settingsAIProvidersPageLoaderQuery,
    loaderData.queryRef
  );
  return (
    <Flex direction="column" gap="size-200">
      <GenerativeProvidersCard query={data} />
      <CustomProvidersCard query={data} />
    </Flex>
  );
}
