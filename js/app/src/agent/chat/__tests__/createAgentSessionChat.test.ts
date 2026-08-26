import { isToolUIPart } from "ai";
import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createClientToolTimingRecorder } from "@phoenix/agent/chat/clientToolTimings";
import {
  INTERRUPTED_TURN_POLL_INTERVAL_MS,
  applyClientToolTimingMetadata,
  createAgentSessionChat,
  getTurnClientState,
} from "@phoenix/agent/chat/createAgentSessionChat";
import { PENDING_TOOL_CALL_NOT_RESTORED_ERROR } from "@phoenix/agent/chat/rehydratePendingToolCalls";
import type {
  AgentUIMessage,
  AgentUIMessagePart,
} from "@phoenix/agent/chat/types";
import { ASK_USER_TOOL_NAME } from "@phoenix/agent/tools/elicit";
import { EDIT_PROMPT_TOOL_NAME } from "@phoenix/agent/tools/playgroundPrompt";
import { createAgentStore } from "@phoenix/store/agentStore";

const CLIENT_EXECUTION_METADATA = {
  phoenix: { toolExecutionEnvironment: "client" },
};

function createRelayEnvironment() {
  return new Environment({
    network: Network.create(() => Promise.resolve({ data: {} })),
    store: new Store(new RecordSource()),
  });
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("applyClientToolTimingMetadata", () => {
  it("bakes recorded timings into the resolved part so a resend survives the recorder clearing", () => {
    let now = new Date("2026-08-11T16:08:57.143Z");
    const toolTimings = createClientToolTimingRecorder({
      getCurrentTime: () => now,
    });
    toolTimings.recordStart("tool-call-1");
    now = new Date("2026-08-11T16:08:57.150Z");
    toolTimings.recordEnd("tool-call-1");
    const messages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "output-available",
            input: { edits: [] },
            output: "done",
            callProviderMetadata: CLIENT_EXECUTION_METADATA,
          } as AgentUIMessagePart,
        ],
      },
    ];

    const updated = applyClientToolTimingMetadata({
      messages,
      toolCallId: "tool-call-1",
      toolTimings,
    });

    // The transcript copy now matches the enriched wire payload, so building
    // a resend after toolTimings.clear() reproduces the persisted part.
    toolTimings.clear();
    const part = updated[0]?.parts.find((candidate) => isToolUIPart(candidate));
    expect(part).toMatchObject({
      callProviderMetadata: {
        phoenix: {
          toolExecutionEnvironment: "client",
          clientStartedAt: "2026-08-11T16:08:57.143Z",
          clientEndedAt: "2026-08-11T16:08:57.150Z",
        },
      },
    });
    // The original messages are not mutated.
    expect(messages[0]?.parts[0]).toMatchObject({
      callProviderMetadata: CLIENT_EXECUTION_METADATA,
    });
    const firstPart = messages[0]?.parts[0] as
      | { callProviderMetadata: object }
      | undefined;
    expect(firstPart?.callProviderMetadata).toEqual(CLIENT_EXECUTION_METADATA);
  });

  it("returns the same array when the call has no recorded timings", () => {
    const toolTimings = createClientToolTimingRecorder();
    const messages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "output-available",
            input: { edits: [] },
            output: "done",
            callProviderMetadata: CLIENT_EXECUTION_METADATA,
          } as AgentUIMessagePart,
        ],
      },
    ];

    expect(
      applyClientToolTimingMetadata({
        messages,
        toolCallId: "tool-call-1",
        toolTimings,
      })
    ).toBe(messages);
    expect(
      applyClientToolTimingMetadata({
        messages,
        toolCallId: "tool-call-unknown",
        toolTimings,
      })
    ).toBe(messages);
  });
});

type UIMessageStreamChunk = Record<string, unknown>;

/**
 * A UI message stream response that emits `chunks` and then stays open until
 * the request is aborted (mirroring a real fetch, whose body read rejects on
 * abort) or `shouldClose` is set.
 */
function createUIMessageStreamResponse({
  chunks,
  signal,
  shouldClose = false,
}: {
  chunks: UIMessageStreamChunk[];
  signal: AbortSignal | null | undefined;
  shouldClose?: boolean;
}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
        );
      }
      if (shouldClose) {
        controller.close();
        return;
      }
      signal?.addEventListener(
        "abort",
        () => controller.error(new DOMException("Aborted", "AbortError")),
        { once: true }
      );
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

function createRelayEnvironmentWithSyncState(
  getSyncState: () => { isActive: boolean; lastMessageId: string | null }
) {
  return new Environment({
    network: Network.create((operation) => {
      if (operation.name !== "agentSessionRelaySessionSyncStateQuery") {
        return Promise.resolve({ data: {} });
      }
      const syncState = getSyncState();
      return Promise.resolve({
        data: {
          agentSession: {
            __typename: "AgentSession",
            id: "session-1",
            isActive: syncState.isActive,
            updatedAt: "2026-08-25T00:00:00Z",
            lastMessageId: syncState.lastMessageId,
          },
        },
      });
    }),
    store: new Store(new RecordSource()),
  });
}

describe("createAgentSessionChat stop", () => {
  it("holds the next send after a stop until the server releases the turn lock", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      let isTurnLockHeld = true;
      const getSyncState = vi.fn(() => ({
        isActive: isTurnLockHeld,
        lastMessageId: isTurnLockHeld ? "user-1" : "assistant-1",
      }));
      const fetchMock = vi.fn(
        async (_input: RequestInfo | URL, init?: RequestInit) =>
          fetchMock.mock.calls.length === 1
            ? createUIMessageStreamResponse({
                chunks: [
                  { type: "start", messageId: "assistant-1" },
                  { type: "text-start", id: "text-1" },
                  { type: "text-delta", id: "text-1", delta: "Partial" },
                ],
                signal: init?.signal,
              })
            : createUIMessageStreamResponse({
                chunks: [
                  { type: "start", messageId: "assistant-2" },
                  { type: "finish" },
                ],
                signal: init?.signal,
                shouldClose: true,
              })
      );
      vi.stubGlobal("fetch", fetchMock);
      const chat = createAgentSessionChat({
        sessionId: "session-1",
        seedMessages: [],
        store: createAgentStore(),
        relayEnvironment: createRelayEnvironmentWithSyncState(getSyncState),
        onTranscriptSynced: () => undefined,
      });

      void chat.sendMessage({ text: "hello" });
      await vi.waitFor(() => {
        expect(chat.messages.at(-1)).toMatchObject({
          id: "assistant-1",
          role: "assistant",
        });
      });
      await chat.stop();
      // The stop starts probing for the lock release right away.
      await vi.waitFor(() => {
        expect(getSyncState).toHaveBeenCalledTimes(1);
      });

      // The follow-up is held while the server still holds the lock (it
      // persists the interrupted turn before releasing it).
      void chat.sendMessage({ text: "again" });
      await vi.advanceTimersByTimeAsync(INTERRUPTED_TURN_POLL_INTERVAL_MS);
      await flushMicrotasks();
      expect(getSyncState).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      isTurnLockHeld = false;
      await vi.advanceTimersByTimeAsync(INTERRUPTED_TURN_POLL_INTERVAL_MS);
      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });
      expect(getSyncState).toHaveBeenCalledTimes(3);
      const secondRequestBody = JSON.parse(
        String(fetchMock.mock.calls[1]?.[1]?.body)
      ) as { lastMessageId: string | null };
      expect(secondRequestBody.lastMessageId).toBe("assistant-1");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createAgentSessionChat rehydration", () => {
  it("resolves a seeded pending call of a non-rehydratable tool with an error without sending a request", async () => {
    const fetchMock = vi.fn(() => new Promise<never>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);
    const store = createAgentStore();
    const seedMessages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "input-available",
            input: { edits: [] },
            callProviderMetadata: CLIENT_EXECUTION_METADATA,
          } as AgentUIMessagePart,
        ],
      },
    ];

    const chat = createAgentSessionChat({
      sessionId: "test-session",
      seedMessages,
      store,
      relayEnvironment: createRelayEnvironment(),
      onTranscriptSynced: () => undefined,
    });
    await flushMicrotasks();

    const toolPart = chat.messages
      .at(-1)
      ?.parts.find(
        (part) => isToolUIPart(part) && part.toolCallId === "tool-call-1"
      );
    expect(toolPart).toMatchObject({
      state: "output-error",
      errorText: PENDING_TOOL_CALL_NOT_RESTORED_ERROR,
    });
    expect(fetchMock).not.toHaveBeenCalled();

    // Session sync replacing the transcript with the server's copy (where
    // the call is still pending) reverts the recovery; re-running re-applies.
    chat.messages = seedMessages;
    getTurnClientState(chat)?.recoverPendingToolCalls();
    expect(
      chat.messages
        .at(-1)
        ?.parts.find(
          (part) => isToolUIPart(part) && part.toolCallId === "tool-call-1"
        )
    ).toMatchObject({
      state: "output-error",
      errorText: PENDING_TOOL_CALL_NOT_RESTORED_ERROR,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves a pending call untouched while its handler is still in flight in this client", async () => {
    const store = createAgentStore();
    const chat = createAgentSessionChat({
      sessionId: "test-session",
      seedMessages: [],
      store,
      relayEnvironment: createRelayEnvironment(),
      onTranscriptSynced: () => undefined,
    });
    await flushMicrotasks();

    const pendingMessages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${EDIT_PROMPT_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "input-available",
            input: { edits: [] },
            callProviderMetadata: CLIENT_EXECUTION_METADATA,
          } as AgentUIMessagePart,
        ],
      },
    ];
    const turnClientState = getTurnClientState(chat);
    // Simulate the dispatch bracket a live client tool run holds open, then a
    // transcript sync replacing the messages while the approval is pending.
    turnClientState?.toolTimings.recordStart("tool-call-1");
    chat.messages = pendingMessages;
    turnClientState?.recoverPendingToolCalls();
    expect(chat.messages.at(-1)?.parts[0]).toMatchObject({
      state: "input-available",
    });

    // Once the run resolves (output recorded), a later sync that resurrects
    // the pending part treats it as stale again.
    turnClientState?.toolTimings.recordEnd("tool-call-1");
    chat.messages = pendingMessages;
    turnClientState?.recoverPendingToolCalls();
    expect(chat.messages.at(-1)?.parts[0]).toMatchObject({
      state: "output-error",
      errorText: PENDING_TOOL_CALL_NOT_RESTORED_ERROR,
    });
  });

  it("re-stages a seeded pending approval so a page refresh restores the answer card", async () => {
    const store = createAgentStore();
    const seedMessages: AgentUIMessage[] = [
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "ask me something" }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${ASK_USER_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "input-available",
            input: {
              questions: [
                { id: "q1", prompt: "Which dataset?", type: "freeform" },
              ],
            },
            callProviderMetadata: CLIENT_EXECUTION_METADATA,
          } as AgentUIMessagePart,
        ],
      },
    ];

    createAgentSessionChat({
      sessionId: "test-session",
      seedMessages,
      store,
      relayEnvironment: createRelayEnvironment(),
      onTranscriptSynced: () => undefined,
    });
    await flushMicrotasks();

    const pending =
      store.getState().pendingElicitationBySessionId["test-session"];
    expect(pending).toBeDefined();
    expect(pending?.toolCallId).toBe("tool-call-1");
    expect(pending?.questions).toHaveLength(1);
  });

  it("does not stage anything when the seeded tail has no pending client tool calls", async () => {
    const store = createAgentStore();
    const seedMessages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${ASK_USER_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "output-available",
            input: {},
            output: { status: "answered" },
            callProviderMetadata: CLIENT_EXECUTION_METADATA,
          } as AgentUIMessagePart,
          { type: "text", text: "Thanks for answering." },
        ],
      },
    ];

    createAgentSessionChat({
      sessionId: "test-session",
      seedMessages,
      store,
      relayEnvironment: createRelayEnvironment(),
      onTranscriptSynced: () => undefined,
    });
    await flushMicrotasks();

    expect(store.getState().pendingAnnotationConfigWritesByToolCallId).toEqual(
      {}
    );
  });
});
