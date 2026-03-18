import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import { CustomProvidersCard } from "@phoenix/pages/settings/CustomProvidersCard";
import { GenerativeProvidersCard } from "@phoenix/pages/settings/GenerativeProvidersCard";
import {
  settingsAIProvidersPageLoaderQuery,
  type SettingsAIProvidersLoaderData,
} from "@phoenix/pages/settings/settingsAIProvidersPageLoader";

import type { settingsAIProvidersPageLoaderQuery as settingsAIProvidersPageLoaderQueryType } from "./__generated__/settingsAIProvidersPageLoaderQuery.graphql";

export function SettingsAIProvidersPage() {
  const loaderData = useLoaderData() as
    | SettingsAIProvidersLoaderData
    | undefined;
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery<settingsAIProvidersPageLoaderQueryType>(
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
