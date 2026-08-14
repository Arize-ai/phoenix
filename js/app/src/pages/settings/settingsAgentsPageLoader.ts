import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { settingsAgentsPageLoaderQuery } from "./__generated__/settingsAgentsPageLoaderQuery.graphql";
import { SETTINGS_AGENT_SESSIONS_PAGE_SIZE } from "./settingsAgentSessionConstants";

export const settingsAgentsPageLoaderGql = graphql`
  query settingsAgentsPageLoaderQuery($first: Int!) {
    ...SettingsAgentSessionsCard_sessions @arguments(first: $first)
  }
`;

export function settingsAgentsPageLoader() {
  return loadQuery<settingsAgentsPageLoaderQuery>(
    RelayEnvironment,
    settingsAgentsPageLoaderGql,
    { first: SETTINGS_AGENT_SESSIONS_PAGE_SIZE },
    { fetchPolicy: "store-and-network" }
  );
}

export type SettingsAgentsPageLoaderType = ReturnType<
  typeof settingsAgentsPageLoader
>;
