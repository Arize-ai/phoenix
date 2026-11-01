import type { Chat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRemovedUserMessageText } from "@phoenix/agent/chat/removedUserMessageText";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { createAgentStore, type AgentStore } from "@phoenix/store/agentStore";

import { getCompactionBlockedReason, useAgentChat } from "../useAgentChat";

let mockChatInstance: Chat<AgentUIMessage> | null = null;

vi.mock("@phoenix/contexts/AgentChatRuntimeContext", () => ({
  useAgentChatRuntime: () => ({
    getChat: () => mockChatInstance,
    getOrCreateChat: () => mockChatInstance,
    evictChat: vi.fn(),
  }),
}));

function createRelayEnvironment() {
  return new Environment({
    network: Network.create(() => Promise.resolve({ data: {} })),
    store: new Store(new RecordSource()),
  });
}

function createStubChat({
  status = "ready",
  stop = vi.fn().mockResolvedValue(undefined),
}: {
  status?: ChatStatus;
  stop?: () => Promise<void>;
} = {}): Chat<AgentUIMessage> {
  return {
    status,
    messages: [],
    error: undefined,
    stop,
    clearError: vi.fn(),
    addToolOutput: vi.fn().mockResolvedValue(undefined),
    "~registerMessagesCallback": () => () => {},
    "~registerStatusCallback": () => () => {},
    "~registerErrorCallback": () => () => {},
  } as unknown as Chat<AgentUIMessage>;
}

describe("getRemovedUserMessageText", () => {
  it("does not restore a compaction checkpoint into the composer", () => {
    const compactionMessage = {
      id: "compaction-message",
      role: "user",
      metadata: {
        phoenix: {
          type: "user",
          currentDateTime: "2026-01-01T00:00:00Z",
          timeZone: "UTC",
          isCompactionMessage: true,
        },
      },
      parts: [{ type: "text", text: '{"objectives":["Understand traces"]}' }],
    } as AgentUIMessage;

    expect(
      getRemovedUserMessageText([compactionMessage], compactionMessage.id)
    ).toBeNull();
  });

  it("continues to restore ordinary user messages", () => {
    const userMessage = {
      id: "user-message",
      role: "user",
      parts: [{ type: "text", text: "What is a trace?" }],
    } as AgentUIMessage;

    expect(getRemovedUserMessageText([userMessage], userMessage.id)).toBe(
      "What is a trace?"
    );
  });
});

describe("getCompactionBlockedReason", () => {
  const unblocked = {
    isResponseInProgress: false,
    isCompactionPending: false,
    isBusyElsewhere: false,
  };

  it("allows compaction when no precondition blocks it", () => {
    expect(getCompactionBlockedReason(unblocked)).toBeNull();
  });

  it("blocks while this client's response is in flight", () => {
    expect(
      getCompactionBlockedReason({ ...unblocked, isResponseInProgress: true })
    ).toBe("Wait for the current response to finish and try again.");
  });

  it("blocks while a compaction is already pending", () => {
    expect(
      getCompactionBlockedReason({ ...unblocked, isCompactionPending: true })
    ).toBe("Conversation compaction is already in progress.");
  });

  it("blocks while another client holds the session lock", () => {
    expect(
      getCompactionBlockedReason({ ...unblocked, isBusyElsewhere: true })
    ).toBe(
      "Session is being used elsewhere. Try again when the other turn completes."
    );
  });

  it("reports the in-flight response before other blockers", () => {
    expect(
      getCompactionBlockedReason({
        isResponseInProgress: true,
        isCompactionPending: true,
        isBusyElsewhere: true,
      })
    ).toBe("Wait for the current response to finish and try again.");
  });
});

describe("useAgentChat stop cancellation marker", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: AgentStore;
  let relayEnvironment: Environment;
  let capturedChatApi: ReturnType<typeof useAgentChat> | null = null;

  function ChatProbe({
    sessionId = "session-1",
  }: {
    sessionId?: string | null;
  }) {
    const chatApi = useAgentChat({ sessionId });
    useEffect(() => {
      capturedChatApi = chatApi;
    }, [chatApi]);
    return null;
  }

  function renderProbe({
    sessionId = "session-1",
  }: { sessionId?: string | null } = {}) {
    act(() => {
      root.render(
        <RelayEnvironmentProvider environment={relayEnvironment}>
          <AgentContext.Provider value={store}>
            <ChatProbe sessionId={sessionId} />
          </AgentContext.Provider>
        </RelayEnvironmentProvider>
      );
    });
  }

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    store = createAgentStore();
    relayEnvironment = createRelayEnvironment();
    capturedChatApi = null;
    mockChatInstance = null;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("records a local cancellation marker before the async stop operation resolves when request is active", async () => {
    let resolveStop: () => void;
    let stopResolved = false;
    const stopPromise = new Promise<void>((resolve) => {
      resolveStop = () => {
        stopResolved = true;
        resolve();
      };
    });

    const stopMock = vi.fn().mockImplementation(() => stopPromise);
    mockChatInstance = createStubChat({ status: "streaming", stop: stopMock });

    renderProbe({ sessionId: "session-1" });
    expect(capturedChatApi).not.toBeNull();

    let stopComplete = false;
    let stopPromiseCall: Promise<void> | undefined;
    act(() => {
      stopPromiseCall = capturedChatApi!.stop().then(() => {
        stopComplete = true;
      });
    });

    expect(stopMock).toHaveBeenCalled();
    expect(stopResolved).toBe(false);
    expect(stopComplete).toBe(false);

    const cancelledAt =
      store.getState().locallyCancelledSessionAtBySessionId["session-1"];
    expect(cancelledAt).toBeTypeOf("number");

    resolveStop!();
    await act(async () => {
      await stopPromiseCall;
    });

    expect(stopResolved).toBe(true);
    expect(stopComplete).toBe(true);
  });

  it("does not record a cancellation marker when stopping an inactive request", async () => {
    const stopMock = vi.fn().mockResolvedValue(undefined);
    mockChatInstance = createStubChat({ status: "ready", stop: stopMock });

    renderProbe({ sessionId: "session-1" });
    expect(capturedChatApi).not.toBeNull();

    await act(async () => {
      await capturedChatApi!.stop();
    });

    expect(stopMock).toHaveBeenCalled();
    expect(
      store.getState().locallyCancelledSessionAtBySessionId["session-1"]
    ).toBeUndefined();
  });

  it("does not record a cancellation marker for a draft session", async () => {
    const stopMock = vi.fn().mockResolvedValue(undefined);
    mockChatInstance = createStubChat({ status: "streaming", stop: stopMock });

    renderProbe({ sessionId: null });
    expect(capturedChatApi).not.toBeNull();

    await act(async () => {
      await capturedChatApi!.stop();
    });

    expect(
      store.getState().locallyCancelledSessionAtBySessionId["session-1"]
    ).toBeUndefined();
  });
});
