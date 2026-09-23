import { fetchQuery, graphql } from "react-relay";

import type { agentSessionRelaySessionQuery } from "./__generated__/agentSessionRelaySessionQuery.graphql";
import type { agentSessionRelaySessionSyncStateQuery } from "./__generated__/agentSessionRelaySessionSyncStateQuery.graphql";

export const AGENT_SESSIONS_CONNECTION_KEY =
  "AgentSessionsResource_agentSessions";
export const SETTINGS_AGENT_SESSIONS_CONNECTION_KEY =
  "SettingsAgentSessionsCard_agentSessions";

export const SESSION_PAGE_SIZE = 20;
export const MAX_AGENT_SESSION_TITLE_LENGTH = 100;

export type RelayEnvironment = Parameters<typeof fetchQuery>[0];

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
        isTemporary: isEphemeral
        isActive
        createdAt
        updatedAt
        firstInput
        latestOutput
        user {
          username
          profilePictureUrl
        }
        lastMessageId
        ...agentSessionModel_session
        messages
      }
    }
  }
`;

/**
 * Cheap synchronization probe: whether another client's turn holds the
 * session lock and where the persisted transcript's tail currently is.
 * Polling fetches this first and only refetches the full transcript when the
 * tail has moved, so idle sessions don't re-download megabytes of messages.
 */
export const agentSessionSyncStateQuery = graphql`
  query agentSessionRelaySessionSyncStateQuery($id: ID!) {
    agentSession: node(id: $id) {
      __typename
      ... on AgentSession {
        id
        isActive
        updatedAt
        lastMessageId
      }
    }
  }
`;

/**
 * The probe's change signal. `updatedAt` moves on every persistence path
 * (turn persist, trailing-message rewrite, truncate, compact) and
 * `lastMessageId` guards against timestamp-resolution collisions on appends.
 */
export type AgentSessionSyncState = {
  updatedAt: string;
  lastMessageId: string | null;
};

/**
 * Fetches the cheap sync probe for a session (network-only), returning null
 * when the node is missing or not an AgentSession.
 */
export async function fetchAgentSessionSyncState({
  environment,
  sessionId,
}: {
  environment: RelayEnvironment;
  sessionId: string;
}): Promise<(AgentSessionSyncState & { isActive: boolean }) | null> {
  const data = await fetchQuery<agentSessionRelaySessionSyncStateQuery>(
    environment,
    agentSessionSyncStateQuery,
    { id: sessionId },
    { fetchPolicy: "network-only" }
  ).toPromise();
  const agentSession =
    data?.agentSession.__typename === "AgentSession" ? data.agentSession : null;
  if (!agentSession) {
    return null;
  }
  return {
    isActive: agentSession.isActive,
    updatedAt: agentSession.updatedAt,
    lastMessageId: agentSession.lastMessageId,
  };
}

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
