import { isToolUIPart } from "ai";
import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createClientToolTimingRecorder } from "@phoenix/agent/chat/clientToolTimings";
import {
  applyClientToolTimingMetadata,
  createAgentSessionChat,
  getTurnClientState,
} from "@phoenix/agent/chat/createAgentSessionChat";
import { PENDING_TOOL_CALL_NOT_RESTORED_ERROR } from "@phoenix/agent/chat/rehydratePendingToolCalls";
import type {
  AgentUIMessage,
  AgentUIMessagePart,
} from "@phoenix/agent/chat/types";
import { CREATE_ANNOTATION_CONFIG_TOOL_NAME } from "@phoenix/agent/tools/annotationConfig";
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
    expect(
      (messages[0]?.parts[0] as { callProviderMetadata: object })
        .callProviderMetadata
    ).toEqual(CLIENT_EXECUTION_METADATA);
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

  it("re-stages a seeded pending approval so a page refresh restores the Accept/Reject card", async () => {
    const store = createAgentStore();
    const seedMessages: AgentUIMessage[] = [
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "propose an annotation config" }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${CREATE_ANNOTATION_CONFIG_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "input-available",
            input: {
              type: "categorical",
              name: "quality",
              values: [
                { label: "good", score: 1 },
                { label: "bad", score: 0 },
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
      store.getState().pendingAnnotationConfigWritesByToolCallId["tool-call-1"];
    expect(pending).toBeDefined();
    expect(pending?.preview.kind).toBe("create");
    expect(pending?.accept).toBeDefined();
    expect(pending?.reject).toBeDefined();
  });

  it("does not stage anything when the seeded tail has no pending client tool calls", async () => {
    const store = createAgentStore();
    const seedMessages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${CREATE_ANNOTATION_CONFIG_TOOL_NAME}`,
            toolCallId: "tool-call-1",
            state: "output-available",
            input: {},
            output: { status: "accepted" },
            callProviderMetadata: CLIENT_EXECUTION_METADATA,
          } as AgentUIMessagePart,
          { type: "text", text: "Created the config." },
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
