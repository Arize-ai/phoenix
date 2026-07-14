import { fetchQuery } from "react-relay";

import type { AgentSessionsResourceQuery } from "./__generated__/AgentSessionsResourceQuery.graphql";
import AgentSessionsResourceQueryNode from "./__generated__/AgentSessionsResourceQuery.graphql";

export const AGENT_SESSIONS_CONNECTION_KEY =
  "AgentSessionsResource_agentSessions";

export const SESSION_PAGE_SIZE = 20;

type RelayEnvironment = Parameters<typeof fetchQuery>[0];

/**
 * Refetches the first page of the agent sessions connection so a session the
 * server just persisted appears in the session list without hand-editing the
 * Relay store. Refetching from the start resets the connection to the newest
 * page, dropping any previously paginated pages.
 *
 * `fetchQuery` alone does not retain its data, but the payload normalizes into
 * the same operation the mounted session list retains via `useLazyLoadQuery`,
 * so the refreshed edges stay reachable for as long as the list is on screen.
 */
export function refetchAgentSessions({
  environment,
}: {
  environment: RelayEnvironment;
}) {
  return fetchQuery<AgentSessionsResourceQuery>(
    environment,
    AgentSessionsResourceQueryNode,
    { first: SESSION_PAGE_SIZE }
  ).toPromise();
}
