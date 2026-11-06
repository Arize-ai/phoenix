import { graphql, loadQuery } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { settingsAgentsChatsLoaderQuery } from "./__generated__/settingsAgentsChatsLoaderQuery.graphql";
import { SETTINGS_AGENT_SESSIONS_PAGE_SIZE } from "./settingsAgentSessionConstants";

export const settingsAgentsChatsLoaderGql = graphql`
  query settingsAgentsChatsLoaderQuery($first: Int!) {
    ...SettingsAgentSessionsCard_sessions @arguments(first: $first)
  }
`;

export function settingsAgentsChatsLoader() {
  return loadQuery<settingsAgentsChatsLoaderQuery>(
    RelayEnvironment,
    settingsAgentsChatsLoaderGql,
    { first: SETTINGS_AGENT_SESSIONS_PAGE_SIZE },
    { fetchPolicy: "store-and-network" }
  );
}

export type SettingsAgentsChatsLoaderType = ReturnType<
  typeof settingsAgentsChatsLoader
>;
