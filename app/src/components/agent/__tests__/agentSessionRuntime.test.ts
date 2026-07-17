import { describe, expect, it } from "vitest";

import {
  getPersistedAgentSessionId,
  shouldHydrateAgentSession,
} from "../agentSessionRuntime";

describe("getPersistedAgentSessionId", () => {
  it("prefers the Relay ID already reconciled into the session cache", () => {
    expect(
      getPersistedAgentSessionId({
        cachedSessionId: "QWdlbnRTZXNzaW9uOjE=",
        listedSessionId: "QWdlbnRTZXNzaW9uOjI=",
      })
    ).toBe("QWdlbnRTZXNzaW9uOjE=");
  });

  it("uses the server-listed ID before a session is cached", () => {
    expect(
      getPersistedAgentSessionId({
        cachedSessionId: undefined,
        listedSessionId: "QWdlbnRTZXNzaW9uOjI=",
      })
    ).toBe("QWdlbnRTZXNzaW9uOjI=");
  });

  it("returns null for a new browser-only session", () => {
    expect(
      getPersistedAgentSessionId({
        cachedSessionId: null,
        listedSessionId: null,
      })
    ).toBeNull();
  });
});

describe("shouldHydrateAgentSession", () => {
  it("hydrates an unvisited server-listed session", () => {
    expect(
      shouldHydrateAgentSession({
        hasRuntime: false,
        persistedSessionId: undefined,
      })
    ).toBe(true);
  });

  it("hydrates cached persisted metadata after runtime eviction", () => {
    expect(
      shouldHydrateAgentSession({
        hasRuntime: false,
        persistedSessionId: "session-node-id",
      })
    ).toBe(true);
  });

  it("does not hydrate a new local session", () => {
    expect(
      shouldHydrateAgentSession({
        hasRuntime: false,
        persistedSessionId: null,
      })
    ).toBe(false);
  });

  it("reuses an existing runtime", () => {
    expect(
      shouldHydrateAgentSession({
        hasRuntime: true,
        persistedSessionId: "session-node-id",
      })
    ).toBe(false);
  });
});
