import { fetchQuery, graphql } from "react-relay";

import type { agentSessionRelaySessionQuery } from "./__generated__/agentSessionRelaySessionQuery.graphql";

export const AGENT_SESSIONS_CONNECTION_KEY =
  "AgentSessionsResource_agentSessions";
export const SETTINGS_AGENT_SESSIONS_CONNECTION_KEY =
  "SettingsAgentSessionsCard_agentSessions";

export const SESSION_PAGE_SIZE = 20;
export const MAX_AGENT_SESSION_TITLE_LENGTH = 100;

type RelayEnvironment = Parameters<typeof fetchQuery>[0];

/**
 * Canonical per-session read: identity, title, and the persisted transcript.
 * Used to seed a chat runtime when a session's surface first binds, and
 * refetched after each completed turn so Relay stays the durable source of
 * truth for session state.
 */
export const agentSessionQuery = graphql`
  query agentSessionRelaySessionQuery($id: ID!) {
    agentSession: node(id: $id) {
      __typename
      ... on AgentSession {
        id
        title
        isTemporary
        createdAt
        updatedAt
        firstInput
        latestOutput
        user {
          username
          profilePictureUrl
        }
        messages
      }
    }
  }
`;

/**
 * Refetches a session's canonical record (title, timestamps, transcript) from
 * the network, e.g. when a chat turn ends and the server has persisted the
 * turn's messages and possibly a summarized title.
 *
 * `fetchQuery` alone does not retain its data, but the payload normalizes into
 * the same records retained by the mounted session list and transcript views,
 * so the refreshed fields stay reachable for as long as those are on screen.
 */
export function refetchAgentSession({
  environment,
  sessionId,
}: {
  environment: RelayEnvironment;
  sessionId: string;
}) {
  return fetchQuery<agentSessionRelaySessionQuery>(
    environment,
    agentSessionQuery,
    { id: sessionId },
    { fetchPolicy: "network-only" }
  ).toPromise();
}
