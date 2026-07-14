import { ConnectionHandler, commitLocalUpdate } from "react-relay";

import type { AgentSessionCreatedData } from "@phoenix/agent/chat/types";

export const AGENT_SESSIONS_CONNECTION_KEY =
  "AgentSessionsResource_agentSessions";

type RelayEnvironment = Parameters<typeof commitLocalUpdate>[0];

export function upsertAgentSessionConnection({
  environment,
  session,
}: {
  environment: RelayEnvironment;
  session: AgentSessionCreatedData;
}) {
  commitLocalUpdate(environment, (store) => {
    const sessionRecord =
      store.get(session.id) ?? store.create(session.id, "AgentSession");
    sessionRecord.setValue(session.sessionId, "sessionId");
    sessionRecord.setValue(session.title, "title");
    sessionRecord.setValue(session.createdAt, "createdAt");
    sessionRecord.setValue(session.updatedAt, "updatedAt");

    const connection = ConnectionHandler.getConnection(
      store.getRoot(),
      AGENT_SESSIONS_CONNECTION_KEY
    );
    if (!connection) {
      return;
    }
    const hasSession =
      connection.getLinkedRecords("edges")?.some((edge) => {
        const node = edge.getLinkedRecord("node");
        return (
          node?.getDataID() === session.id ||
          node?.getValue("sessionId") === session.sessionId
        );
      }) ?? false;
    if (hasSession) {
      return;
    }
    const edge = ConnectionHandler.createEdge(
      store,
      connection,
      sessionRecord,
      "AgentSessionEdge"
    );
    ConnectionHandler.insertEdgeBefore(connection, edge);
  });
}

export function updateAgentSessionTitle({
  environment,
  sessionId,
  title,
}: {
  environment: RelayEnvironment;
  sessionId: string;
  title: string;
}) {
  commitLocalUpdate(environment, (store) => {
    const connection = ConnectionHandler.getConnection(
      store.getRoot(),
      AGENT_SESSIONS_CONNECTION_KEY
    );
    const sessionRecord = connection
      ?.getLinkedRecords("edges")
      ?.map((edge) => edge.getLinkedRecord("node"))
      .find((node) => node?.getValue("sessionId") === sessionId);
    sessionRecord?.setValue(title, "title");
  });
}
