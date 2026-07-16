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

  it("retains the active session before Relay metadata is cached", () => {
    expect(
      shouldRetainChatRuntime({
        sessionId: "session-a",
        activeSessionId: "session-a",
        liveSessionIds: new Set(),
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
  });

  it("evicts inactive idle sessions for Relay rehydration", () => {
    expect(
      shouldRetainChatRuntime({
        sessionId: "session-a",
        activeSessionId: "session-b",
        liveSessionIds: new Set(["session-a", "session-b"]),
        status: "ready",
      })
    ).toBe(false);
  });

  it("retains inactive sessions with pending tool output", () => {
    expect(
      shouldRetainChatRuntime({
        sessionId: "session-a",
        activeSessionId: "session-b",
        liveSessionIds: new Set(["session-a", "session-b"]),
        status: "ready",
        hasPendingToolOutput: true,
      })
    ).toBe(true);
  });

  it("evicts deleted sessions regardless of status", () => {
    expect(
      shouldRetainChatRuntime({
        sessionId: "session-a",
        activeSessionId: "session-b",
        liveSessionIds: new Set(["session-b"]),
        status: "streaming",
      })
    ).toBe(false);
  });
});
