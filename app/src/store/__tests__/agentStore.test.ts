import {
  _resetAgentMessageId,
  _resetSessionId,
  createAgentStore,
} from "../agentStore";

describe("agentStore", () => {
  beforeEach(() => {
    _resetSessionId();
    _resetAgentMessageId();
  });

  describe("createSession", () => {
    it("creates a session with default model config, adds to sessions/sessionMap, sets as active", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      const state = store.getState();
      expect(state.sessions).toEqual([sessionId]);
      expect(state.activeSessionId).toBe(sessionId);
      expect(state.sessionMap[sessionId]).toBeDefined();
      expect(state.sessionMap[sessionId].modelConfig.provider).toBe(
        "ANTHROPIC"
      );
      expect(state.sessionMap[sessionId].modelConfig.modelName).toBe(
        "claude-opus-4-6"
      );
      expect(state.sessionMap[sessionId].messageIds).toEqual([]);
      expect(state.sessionMap[sessionId].context).toEqual([]);
    });
  });

  describe("deleteSession", () => {
    it("removes session and cascades message cleanup, updates activeSessionId", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      const messageId = store
        .getState()
        .addMessage(sessionId, { role: "user", content: "hello" });
      store.getState().deleteSession(sessionId);
      const state = store.getState();
      expect(state.sessions).toEqual([]);
      expect(state.sessionMap[sessionId]).toBeUndefined();
      expect(state.messageMap[messageId]).toBeUndefined();
      expect(state.activeSessionId).toBeNull();
    });

    it("sets activeSessionId to last remaining session when active is deleted", () => {
      const store = createAgentStore();
      const sessionId1 = store.getState().createSession();
      const sessionId2 = store.getState().createSession();
      // active is sessionId2
      store.getState().deleteSession(sessionId2);
      expect(store.getState().activeSessionId).toBe(sessionId1);
    });
  });

  describe("setActiveSession", () => {
    it("switches active session", () => {
      const store = createAgentStore();
      const sessionId1 = store.getState().createSession();
      const sessionId2 = store.getState().createSession();
      store.getState().setActiveSession(sessionId1);
      expect(store.getState().activeSessionId).toBe(sessionId1);
      store.getState().setActiveSession(sessionId2);
      expect(store.getState().activeSessionId).toBe(sessionId2);
    });
  });

  describe("updateSessionSummary", () => {
    it("updates summary in sessionMap", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      store.getState().updateSessionSummary(sessionId, "test summary");
      expect(store.getState().sessionMap[sessionId].shortSummary).toBe(
        "test summary"
      );
    });
  });

  describe("updateSessionModelConfig", () => {
    it("partial-merges model config", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      store
        .getState()
        .updateSessionModelConfig(sessionId, { modelName: "gpt-4o" });
      const config = store.getState().sessionMap[sessionId].modelConfig;
      expect(config.modelName).toBe("gpt-4o");
      expect(config.provider).toBe("ANTHROPIC"); // unchanged
    });
  });

  describe("addMessage", () => {
    it("creates message in messageMap and appends ID to session messageIds", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      const messageId = store
        .getState()
        .addMessage(sessionId, { role: "user", content: "hello" });
      const state = store.getState();
      expect(state.messageMap[messageId]).toEqual({
        id: messageId,
        role: "user",
        content: "hello",
      });
      expect(state.sessionMap[sessionId].messageIds).toEqual([messageId]);
    });
  });

  describe("updateMessage", () => {
    it("patches message fields", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      const messageId = store
        .getState()
        .addMessage(sessionId, { role: "user", content: "hello" });
      store.getState().updateMessage(messageId, { content: "updated" });
      expect(store.getState().messageMap[messageId].content).toBe("updated");
      expect(store.getState().messageMap[messageId].role).toBe("user");
    });
  });

  describe("deleteMessage", () => {
    it("removes from messageMap and session messageIds", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      const messageId = store
        .getState()
        .addMessage(sessionId, { role: "user", content: "hello" });
      store.getState().deleteMessage(sessionId, messageId);
      const state = store.getState();
      expect(state.messageMap[messageId]).toBeUndefined();
      expect(state.sessionMap[sessionId].messageIds).toEqual([]);
    });
  });

  describe("addSessionContext / removeSessionContext", () => {
    it("manages context array", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      store.getState().addSessionContext(sessionId, "ctx1");
      store.getState().addSessionContext(sessionId, "ctx2");
      expect(store.getState().sessionMap[sessionId].context).toEqual([
        "ctx1",
        "ctx2",
      ]);
      store.getState().removeSessionContext(sessionId, "ctx1");
      expect(store.getState().sessionMap[sessionId].context).toEqual(["ctx2"]);
    });
  });

  describe("clearAllSessions", () => {
    it("resets sessions, sessionMap, messageMap, activeSessionId", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      store
        .getState()
        .addMessage(sessionId, { role: "user", content: "hello" });
      store.getState().clearAllSessions();
      const state = store.getState();
      expect(state.sessions).toEqual([]);
      expect(state.sessionMap).toEqual({});
      expect(state.messageMap).toEqual({});
      expect(state.activeSessionId).toBeNull();
    });
  });

  describe("toggleOpen / setPosition", () => {
    it("toggles isOpen", () => {
      const store = createAgentStore();
      expect(store.getState().isOpen).toBe(false);
      store.getState().toggleOpen();
      expect(store.getState().isOpen).toBe(true);
      store.getState().toggleOpen();
      expect(store.getState().isOpen).toBe(false);
    });

    it("sets position", () => {
      const store = createAgentStore();
      expect(store.getState().position).toBe("detached");
      store.getState().setPosition("pinned");
      expect(store.getState().position).toBe("pinned");
    });
  });
});
