import { useCallback } from "react";
import { commitMutation, fetchQuery, graphql } from "react-relay";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import type { ServerAgentSessionStub } from "@phoenix/store/agentStore";

import type { useAgentServerSessionsDeleteMutation } from "./__generated__/useAgentServerSessionsDeleteMutation.graphql";
import type { useAgentServerSessionsDetailQuery } from "./__generated__/useAgentServerSessionsDetailQuery.graphql";
import type { useAgentServerSessionsListQuery } from "./__generated__/useAgentServerSessionsListQuery.graphql";

const listQuery = graphql`
  query useAgentServerSessionsListQuery($first: Int) {
    agentSessions(first: $first) {
      edges {
        node {
          sessionId
          title
          createdAt
          updatedAt
        }
      }
    }
  }
`;

const detailQuery = graphql`
  query useAgentServerSessionsDetailQuery($sessionId: String!) {
    agentSession(sessionId: $sessionId) {
      messages
    }
  }
`;

const deleteMutation = graphql`
  mutation useAgentServerSessionsDeleteMutation($sessionId: String!) {
    deleteAgentSession(input: { sessionId: $sessionId }) {
      sessionId
    }
  }
`;

/** How many recent sessions to hydrate into the session list. */
const SESSION_LIST_PAGE_SIZE = 20;

/**
 * Bridges the store's in-memory session mirror to the server's persisted
 * sessions (the only durable copy — nothing is kept in localStorage).
 *
 * - `hydrateSessions` fetches the recent-session list once per app load
 * - `activateSession` lazily fetches a stub session's transcript, then makes
 *   it active
 * - `deleteSession` deletes server-side and locally
 */
export function useAgentServerSessions() {
  const store = useAgentStore();

  const hydrateSessions = useCallback(async () => {
    const state = store.getState();
    if (state.serverSessionsHydration !== "idle") {
      return;
    }
    state.setServerSessionsHydration("pending");
    try {
      const data = await fetchQuery<useAgentServerSessionsListQuery>(
        RelayEnvironment,
        listQuery,
        { first: SESSION_LIST_PAGE_SIZE }
      ).toPromise();
      const stubs: ServerAgentSessionStub[] = (
        data?.agentSessions.edges ?? []
      ).map((edge) => ({
        id: edge.node.sessionId,
        title: edge.node.title,
        createdAt: Date.parse(edge.node.createdAt as string),
        updatedAt: Date.parse(edge.node.updatedAt as string),
      }));
      store.getState().hydrateServerSessions(stubs);
      store.getState().setServerSessionsHydration("done");
    } catch {
      store.getState().setServerSessionsHydration("error");
    }
  }, [store]);

  const activateSession = useCallback(
    async (sessionId: string) => {
      const session = store.getState().sessionMap[sessionId];
      if (!session || session.messagesLoaded) {
        store.getState().setActiveSession(sessionId);
        return;
      }
      try {
        const data = await fetchQuery<useAgentServerSessionsDetailQuery>(
          RelayEnvironment,
          detailQuery,
          { sessionId }
        ).toPromise();
        const messages = data?.agentSession?.messages;
        if (Array.isArray(messages)) {
          store
            .getState()
            .setSessionMessages(sessionId, messages as AgentUIMessage[]);
        }
      } catch {
        // Activate anyway: the transcript stays empty for now and the session
        // remains a stub, so a later activation retries the fetch.
      }
      store.getState().setActiveSession(sessionId);
    },
    [store]
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      commitMutation<useAgentServerSessionsDeleteMutation>(RelayEnvironment, {
        mutation: deleteMutation,
        variables: { sessionId },
        // Sessions with no completed turn were never persisted; deleting
        // them is local-only and the server's "not found" is expected.
        onError: () => {},
      });
      store.getState().deleteSession(sessionId);
    },
    [store]
  );

  return { hydrateSessions, activateSession, deleteSession };
}
