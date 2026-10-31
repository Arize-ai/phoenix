import type { Chat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_CANCELLATION_GRACE_MS } from "@phoenix/agent/chat/sessionCancellation";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { createAgentStore, type AgentStore } from "@phoenix/store/agentStore";

import { useAgentSessionSync } from "../useAgentSessionSync";

function createRelayEnvironment() {
  return new Environment({
    network: Network.create(() => Promise.resolve({ data: {} })),
    store: new Store(new RecordSource()),
  });
}

function createStubChat({
  status = "ready",
}: { status?: ChatStatus } = {}): Chat<AgentUIMessage> {
  return {
    status,
    messages: [],
    clearError: vi.fn(),
  } as unknown as Chat<AgentUIMessage>;
}

function SyncProbe({
  sessionId = "session-1",
  chatInstance,
  chatStatus = "ready",
  isActive = true,
  isCompacting = false,
  isBusyElsewhere = false,
}: {
  sessionId?: string | null;
  chatInstance: Chat<AgentUIMessage>;
  chatStatus?: ChatStatus;
  isActive?: boolean;
  isCompacting?: boolean;
  isBusyElsewhere?: boolean;
}) {
  const lastSyncedRef = useRef(null);
  useAgentSessionSync({
    persistedSessionId: sessionId,
    chatInstance,
    chatStatus,
    isActive,
    isCompacting,
    isBusyElsewhere,
    shouldSyncOnMount: false,
    lastSyncedSessionStateRef: lastSyncedRef,
  });
  return null;
}

describe("useAgentSessionSync turn-lock cancellation grace", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: AgentStore;
  let relayEnvironment: Environment;
  let chatInstance: Chat<AgentUIMessage>;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T00:00:00.000Z"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    store = createAgentStore();
    relayEnvironment = createRelayEnvironment();
    chatInstance = createStubChat({ status: "ready" });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  function renderProbe(props: Partial<Parameters<typeof SyncProbe>[0]> = {}) {
    act(() => {
      root.render(
        <RelayEnvironmentProvider environment={relayEnvironment}>
          <AgentContext.Provider value={store}>
            <SyncProbe chatInstance={chatInstance} {...props} />
          </AgentContext.Provider>
        </RelayEnvironmentProvider>
      );
    });
  }

  it("does not enter busy-elsewhere mode when server reports isActive during local cancellation grace", () => {
    store.getState().markSessionLocallyCancelled("session-1");

    renderProbe({ sessionId: "session-1", isActive: true });

    expect(
      store.getState().isBusyElsewhereBySessionId["session-1"]
    ).toBeUndefined();
  });

  it("eventually enters busy-elsewhere mode after the cancellation grace period expires", () => {
    store.getState().markSessionLocallyCancelled("session-1");

    renderProbe({ sessionId: "session-1", isActive: true });

    expect(
      store.getState().isBusyElsewhereBySessionId["session-1"]
    ).toBeUndefined();

    act(() => {
      vi.advanceTimersByTime(SESSION_CANCELLATION_GRACE_MS + 10);
    });

    expect(store.getState().isBusyElsewhereBySessionId["session-1"]).toBe(true);
  });

  it("cleans up the retry timeout when the component unmounts", () => {
    store.getState().markSessionLocallyCancelled("session-1");

    renderProbe({ sessionId: "session-1", isActive: true });

    expect(
      store.getState().isBusyElsewhereBySessionId["session-1"]
    ).toBeUndefined();

    act(() => {
      root.unmount();
    });

    act(() => {
      vi.advanceTimersByTime(SESSION_CANCELLATION_GRACE_MS + 10);
    });

    expect(
      store.getState().isBusyElsewhereBySessionId["session-1"]
    ).toBeUndefined();
  });

  it("cleans up the retry timeout when effect dependencies change", () => {
    store.getState().markSessionLocallyCancelled("session-1");

    renderProbe({ sessionId: "session-1", isActive: true });

    expect(
      store.getState().isBusyElsewhereBySessionId["session-1"]
    ).toBeUndefined();

    // The lock clears server-side before grace expires:
    renderProbe({ sessionId: "session-1", isActive: false });

    act(() => {
      vi.advanceTimersByTime(SESSION_CANCELLATION_GRACE_MS + 10);
    });

    expect(
      store.getState().isBusyElsewhereBySessionId["session-1"]
    ).toBeUndefined();
  });
});
