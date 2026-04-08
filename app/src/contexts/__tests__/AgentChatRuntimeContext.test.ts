import { describe, expect, it } from "vitest";

import { shouldRetainChatRuntime } from "../AgentChatRuntimeContext";

describe("shouldRetainChatRuntime", () => {
  it("retains the active session even when idle", () => {
    expect(
      shouldRetainChatRuntime({
        sessionId: "session-a",
        activeSessionId: "session-a",
        liveSessionIds: new Set(["session-a", "session-b"]),
        status: "ready",
      })
    ).toBe(true);
  });

  it("retains inactive sessions while a response is in flight", () => {
    expect(
      shouldRetainChatRuntime({
        sessionId: "session-a",
        activeSessionId: "session-b",
        liveSessionIds: new Set(["session-a", "session-b"]),
        status: "streaming",
      })
    ).toBe(true);

    expect(
      shouldRetainChatRuntime({
        sessionId: "session-a",
        activeSessionId: "session-b",
        liveSessionIds: new Set(["session-a", "session-b"]),
        status: "submitted",
      })
    ).toBe(true);
  });

  it("evicts inactive idle sessions that still exist in the store", () => {
    expect(
      shouldRetainChatRuntime({
        sessionId: "session-a",
        activeSessionId: "session-b",
        liveSessionIds: new Set(["session-a", "session-b"]),
        status: "ready",
      })
    ).toBe(false);
  });

  it("evicts deleted sessions regardless of status", () => {
    expect(
      shouldRetainChatRuntime({
        sessionId: "session-a",
        activeSessionId: "session-a",
        liveSessionIds: new Set(["session-b"]),
        status: "streaming",
      })
    ).toBe(false);
  });
});
