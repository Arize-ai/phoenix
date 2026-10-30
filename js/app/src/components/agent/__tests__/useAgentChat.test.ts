import { afterEach, describe, expect, it, vi } from "vitest";

import { getRemovedUserMessageText } from "@phoenix/agent/chat/removedUserMessageText";
import {
  isSessionSelfCancellationGraceActive,
  SESSION_CANCELLATION_GRACE_MS,
} from "@phoenix/agent/chat/sessionCancellation";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { createAgentStore } from "@phoenix/store/agentStore";

import { getCompactionBlockedReason } from "../useAgentChat";

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

describe("isSessionSelfCancellationGraceActive", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true immediately after a local cancellation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T06:00:00.000Z"));

    const store = createAgentStore();
    store.getState().markSessionLocallyCancelled("session-1");

    expect(isSessionSelfCancellationGraceActive(store, "session-1")).toBe(true);

    expect(
      typeof store.getState().locallyCancelledSessionAtBySessionId["session-1"]
    ).toBe("number");
  });

  it("expires and clears the cancellation marker after the grace period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T06:00:00.000Z"));

    const store = createAgentStore();
    store.getState().markSessionLocallyCancelled("session-1");

    // Advance beyond the configured cancellation grace period.
    vi.advanceTimersByTime(SESSION_CANCELLATION_GRACE_MS + 1_000);

    expect(isSessionSelfCancellationGraceActive(store, "session-1")).toBe(
      false
    );

    expect(
      store.getState().locallyCancelledSessionAtBySessionId["session-1"]
    ).toBeUndefined();
  });

  it("keeps cancellation markers isolated between sessions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T06:00:00.000Z"));

    const store = createAgentStore();
    store.getState().markSessionLocallyCancelled("session-1");

    expect(isSessionSelfCancellationGraceActive(store, "session-2")).toBe(
      false
    );

    expect(isSessionSelfCancellationGraceActive(store, "session-1")).toBe(true);
  });
});
