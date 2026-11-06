import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { settingsAIProvidersPageLoaderQuery as SettingsAIProvidersPageLoaderQuery } from "./__generated__/settingsAIProvidersPageLoaderQuery.graphql";

export const settingsAIProvidersPageLoaderQuery = graphql`
  query settingsAIProvidersPageLoaderQuery {
    ...GenerativeProvidersCard_data
    ...CustomProvidersCard_data
  }
`;

export function settingsAIProvidersPageLoader() {
  const queryRef = loadQuery<SettingsAIProvidersPageLoaderQuery>(
    RelayEnvironment,
    settingsAIProvidersPageLoaderQuery,
    {}
  );
  return { queryRef };
}

export type SettingsAIProvidersLoaderData = ReturnType<
  typeof settingsAIProvidersPageLoader
>;
