import { ConnectionHandler, commitLocalUpdate } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";

import {
  AGENT_SESSIONS_CONNECTION_KEY,
  updateAgentSessionTitle,
  upsertAgentSessionConnection,
} from "../agentSessionRelay";

function createEnvironment() {
  return new Environment({
    network: Network.create(() => Promise.resolve({ data: {} })),
    store: new Store(new RecordSource()),
  });
}

function createSessionConnection(environment: Environment) {
  commitLocalUpdate(environment, (store) => {
    const connection = store.create(
      ConnectionHandler.getConnectionID(
        store.getRoot().getDataID(),
        AGENT_SESSIONS_CONNECTION_KEY
      ),
      "AgentSessionConnection"
    );
    connection.setLinkedRecords([], "edges");
    store
      .getRoot()
      .setLinkedRecord(
        connection,
        `__${AGENT_SESSIONS_CONNECTION_KEY}_connection`
      );
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

describe("agent session Relay updates", () => {
  it("prepends a created session idempotently", () => {
    const environment = createEnvironment();
    createSessionConnection(environment);
    const session = {
      id: "agent-session-1",
      sessionId: "session-1",
      title: "",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    upsertAgentSessionConnection({ environment, session });
    upsertAgentSessionConnection({
      environment,
      session: { ...session, title: "Updated title" },
    });

    expect(getSessions(environment)).toEqual([
      {
        id: "agent-session-1",
        sessionId: "session-1",
        title: "Updated title",
      },
    ]);
  });

  it("updates a streamed session title", () => {
    const environment = createEnvironment();
    createSessionConnection(environment);
    upsertAgentSessionConnection({
      environment,
      session: {
        id: "agent-session-1",
        sessionId: "session-1",
        title: "",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    });

    updateAgentSessionTitle({
      environment,
      sessionId: "session-1",
      title: "Session title",
    });

    expect(getSessions(environment)[0]?.title).toBe("Session title");
  });
});
