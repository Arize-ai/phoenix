import { createAgentStore } from "../agentStore";

describe("agentStore", () => {
  beforeEach(() => {
    localStorage.removeItem("arize-phoenix-agent");
  });

  describe("createSession", () => {
    it("creates a session, adds it to sessions list, and sets it as active", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      const state = store.getState();
      expect(state.sessions).toEqual([sessionId]);
      expect(state.activeSessionId).toBe(sessionId);
      expect(state.sessionMap[sessionId]).toBeDefined();
    });
  });

  describe("deleteSession", () => {
    it("removes session and clears activeSessionId when no sessions remain", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      store.getState().deleteSession(sessionId);
      const state = store.getState();
      expect(state.sessions).toEqual([]);
      expect(state.sessionMap[sessionId]).toBeUndefined();
      expect(state.activeSessionId).toBeNull();
    });

    it("falls back activeSessionId to last remaining session when active is deleted", () => {
      const store = createAgentStore();
      const sessionId1 = store.getState().createSession();
      const sessionId2 = store.getState().createSession();
      // active is sessionId2
      store.getState().deleteSession(sessionId2);
      expect(store.getState().activeSessionId).toBe(sessionId1);
    });
  });

  describe("updateSessionModelConfig", () => {
    it("partial-merges model config without clobbering other fields", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      const originalProvider =
        store.getState().sessionMap[sessionId].modelConfig.provider;
      store
        .getState()
        .updateSessionModelConfig(sessionId, { modelName: "gpt-4o" });
      const config = store.getState().sessionMap[sessionId].modelConfig;
      expect(config.modelName).toBe("gpt-4o");
      expect(config.provider).toBe(originalProvider);
    });
  });

  describe("setSessionMessages", () => {
    it("no-ops for unknown session", () => {
      const store = createAgentStore();
      const before = store.getState();
      store.getState().setSessionMessages("nonexistent", []);
      expect(store.getState().sessionMap).toBe(before.sessionMap);
    });
  });

  describe("toggleOpen", () => {
    it("toggles isOpen", () => {
      const store = createAgentStore();
      const initial = store.getState().isOpen;
      store.getState().toggleOpen();
      expect(store.getState().isOpen).toBe(!initial);
      store.getState().toggleOpen();
      expect(store.getState().isOpen).toBe(initial);
    });
  });
});
