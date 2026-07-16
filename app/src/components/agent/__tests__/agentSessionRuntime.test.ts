import { describe, expect, it } from "vitest";

import { shouldHydrateAgentSession } from "../agentSessionRuntime";

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
