import { commitLocalUpdate } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";

import { refetchAgentSession } from "../agentSessionRelay";

function sessionPayload({
  id,
  title,
  messages,
}: {
  id: string;
  title: string;
  messages: unknown[];
}) {
  return {
    data: {
      agentSession: {
        __typename: "AgentSession",
        id,
        title,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        firstInput: "Question",
        latestOutput: "Answer",
        isTemporary: false,
        user: null,
        messages,
      },
    },
  };
}

function createEnvironment(payloads: ReturnType<typeof sessionPayload>[]) {
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

function getSessionRecord(environment: Environment, id: string) {
  let record: {
    title: unknown;
    firstInput: unknown;
    latestOutput: unknown;
    messages: unknown;
  } | null = null;
  commitLocalUpdate(environment, (store) => {
    const node = store.get(id);
    record = node
      ? {
          title: node.getValue("title"),
          firstInput: node.getValue("firstInput"),
          latestOutput: node.getValue("latestOutput"),
          messages: node.getValue("messages"),
        }
      : null;
  });
  return record;
}

describe("refetchAgentSession", () => {
  it("hydrates the session record from the server", async () => {
    const environment = createEnvironment([
      sessionPayload({
        id: "agent-session-1",
        title: "First",
        messages: [{ id: "m1", role: "user", parts: [] }],
      }),
    ]);

    await refetchAgentSession({
      environment,
      sessionId: "agent-session-1",
    });

    expect(getSessionRecord(environment, "agent-session-1")).toEqual({
      title: "First",
      firstInput: "Question",
      latestOutput: "Answer",
      messages: [{ id: "m1", role: "user", parts: [] }],
    });
  });

  it("refreshes the record on subsequent turn-end refetches", async () => {
    const environment = createEnvironment([
      sessionPayload({
        id: "agent-session-1",
        title: "",
        messages: [{ id: "m1", role: "user", parts: [] }],
      }),
      sessionPayload({
        id: "agent-session-1",
        title: "Summarized title",
        messages: [
          { id: "m1", role: "user", parts: [] },
          { id: "m2", role: "assistant", parts: [] },
        ],
      }),
    ]);

    await refetchAgentSession({
      environment,
      sessionId: "agent-session-1",
    });
    await refetchAgentSession({
      environment,
      sessionId: "agent-session-1",
    });

    expect(getSessionRecord(environment, "agent-session-1")).toEqual({
      title: "Summarized title",
      firstInput: "Question",
      latestOutput: "Answer",
      messages: [
        { id: "m1", role: "user", parts: [] },
        { id: "m2", role: "assistant", parts: [] },
      ],
    });
  });
});
