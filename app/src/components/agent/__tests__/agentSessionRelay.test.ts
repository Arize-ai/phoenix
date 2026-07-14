import { ConnectionHandler, commitLocalUpdate } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";

import {
  AGENT_SESSIONS_CONNECTION_KEY,
  refetchAgentSessions,
} from "../agentSessionRelay";

type SessionNode = {
  id: string;
  sessionId: string;
  title: string;
};

function sessionsPayload(sessions: SessionNode[]) {
  return {
    data: {
      agentSessions: {
        edges: sessions.map((session, index) => ({
          node: {
            ...session,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
            __typename: "AgentSession",
          },
          cursor: `cursor-${index}`,
        })),
        pageInfo: {
          endCursor: sessions.length ? `cursor-${sessions.length - 1}` : null,
          hasNextPage: false,
        },
      },
    },
  };
}

function createEnvironment(payloads: ReturnType<typeof sessionsPayload>[]) {
  return new Environment({
    network: Network.create(() => {
      const payload = payloads.shift();
      if (!payload) {
        throw new Error("No payload queued for request");
      }
      return Promise.resolve(payload);
    }),
    store: new Store(new RecordSource()),
  });
}

function getSessions(environment: Environment) {
  let sessions: Array<{ id: string; sessionId: unknown; title: unknown }> = [];
  commitLocalUpdate(environment, (store) => {
    const connection = ConnectionHandler.getConnection(
      store.getRoot(),
      AGENT_SESSIONS_CONNECTION_KEY
    );
    sessions =
      connection?.getLinkedRecords("edges")?.flatMap((edge) => {
        const node = edge.getLinkedRecord("node");
        return node
          ? [
              {
                id: node.getDataID(),
                sessionId: node.getValue("sessionId"),
                title: node.getValue("title"),
              },
            ]
          : [];
      }) ?? [];
  });
  return sessions;
}

describe("refetchAgentSessions", () => {
  it("hydrates the sessions connection from the server", async () => {
    const environment = createEnvironment([
      sessionsPayload([
        { id: "agent-session-2", sessionId: "session-2", title: "Second" },
        { id: "agent-session-1", sessionId: "session-1", title: "First" },
      ]),
    ]);

    await refetchAgentSessions({ environment });

    expect(getSessions(environment)).toEqual([
      { id: "agent-session-2", sessionId: "session-2", title: "Second" },
      { id: "agent-session-1", sessionId: "session-1", title: "First" },
    ]);
  });

  it("resets the connection to the newest server page", async () => {
    const environment = createEnvironment([
      sessionsPayload([
        { id: "agent-session-1", sessionId: "session-1", title: "First" },
      ]),
      sessionsPayload([
        { id: "agent-session-2", sessionId: "session-2", title: "Second" },
        { id: "agent-session-1", sessionId: "session-1", title: "Renamed" },
      ]),
    ]);

    await refetchAgentSessions({ environment });
    await refetchAgentSessions({ environment });

    expect(getSessions(environment)).toEqual([
      { id: "agent-session-2", sessionId: "session-2", title: "Second" },
      { id: "agent-session-1", sessionId: "session-1", title: "Renamed" },
    ]);
  });
});
