import {
  clearBashToolRuntime,
  garbageCollectBashToolRuntimes,
  getOrCreateBashToolRuntime,
} from "@phoenix/agent/tools/bash/bashToolSessionRegistry";

describe("bashToolSessionRegistry", () => {
  afterEach(() => {
    clearBashToolRuntime("session-a");
    clearBashToolRuntime("session-b");
    clearBashToolRuntime("session-c");
  });

  it("evicts inactive runtimes while single-session mode is enabled", async () => {
    const runtimeA = await getOrCreateBashToolRuntime("session-a");
    const runtimeB = await getOrCreateBashToolRuntime("session-b");

    garbageCollectBashToolRuntimes({
      activeSessionId: "session-b",
      sessionIds: ["session-a", "session-b"],
    });

    const nextRuntimeA = await getOrCreateBashToolRuntime("session-a");
    const nextRuntimeB = await getOrCreateBashToolRuntime("session-b");

    expect(nextRuntimeA).not.toBe(runtimeA);
    expect(nextRuntimeB).toBe(runtimeB);
  });

  it("removes runtimes for deleted sessions even when retaining inactive ones", async () => {
    const runtimeA = await getOrCreateBashToolRuntime("session-a");
    const runtimeB = await getOrCreateBashToolRuntime("session-b");

    garbageCollectBashToolRuntimes({
      activeSessionId: "session-a",
      sessionIds: ["session-a"],
      retainInactiveSessions: true,
    });

    const nextRuntimeA = await getOrCreateBashToolRuntime("session-a");
    const nextRuntimeB = await getOrCreateBashToolRuntime("session-b");

    expect(nextRuntimeA).toBe(runtimeA);
    expect(nextRuntimeB).not.toBe(runtimeB);
  });
});
