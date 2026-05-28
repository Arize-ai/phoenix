import { createDefaultAgentCapabilities } from "@phoenix/agent/extensions/capabilities";

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
      store.getState().setCapability({
        key: "session.storeSessions",
        enabled: true,
      });
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

  describe("session retention", () => {
    it("replaces prior sessions by default when creating a session", () => {
      const store = createAgentStore();
      const firstSessionId = store.getState().createSession();
      store.getState().setPendingElicitation(firstSessionId, {
        toolCallId: "tool-call-1",
        questions: [],
      });
      store.getState().setSessionChatStatus(firstSessionId, "streaming");

      const secondSessionId = store.getState().createSession();

      expect(store.getState().sessions).toEqual([secondSessionId]);
      expect(store.getState().activeSessionId).toBe(secondSessionId);
      expect(store.getState().sessionMap[firstSessionId]).toBeUndefined();
      expect(
        store.getState().pendingElicitationBySessionId[firstSessionId]
      ).toBeUndefined();
      expect(
        store.getState().chatStatusBySessionId[firstSessionId]
      ).toBeUndefined();
    });

    it("keeps the three newest sessions when recent session storage is enabled", () => {
      const store = createAgentStore();
      store.getState().setCapability({
        key: "session.storeSessions",
        enabled: true,
      });
      const firstSessionId = store.getState().createSession();
      const secondSessionId = store.getState().createSession();
      const thirdSessionId = store.getState().createSession();
      const fourthSessionId = store.getState().createSession();

      expect(store.getState().sessions).toEqual([
        secondSessionId,
        thirdSessionId,
        fourthSessionId,
      ]);
      expect(store.getState().activeSessionId).toBe(fourthSessionId);
      expect(store.getState().sessionMap[firstSessionId]).toBeUndefined();
      expect(store.getState().sessionMap[secondSessionId]).toBeDefined();
      expect(store.getState().sessionMap[thirdSessionId]).toBeDefined();
      expect(store.getState().sessionMap[fourthSessionId]).toBeDefined();
    });

    it("prunes to the active session when recent session storage is disabled", () => {
      const store = createAgentStore();
      store.getState().setCapability({
        key: "session.storeSessions",
        enabled: true,
      });
      const firstSessionId = store.getState().createSession();
      const secondSessionId = store.getState().createSession();
      store.getState().setPendingElicitation(firstSessionId, {
        toolCallId: "tool-call-1",
        questions: [],
      });
      store.getState().setSessionChatStatus(firstSessionId, "streaming");

      store.getState().setCapability({
        key: "session.storeSessions",
        enabled: false,
      });

      expect(store.getState().sessions).toEqual([secondSessionId]);
      expect(store.getState().activeSessionId).toBe(secondSessionId);
      expect(store.getState().sessionMap[firstSessionId]).toBeUndefined();
      expect(
        store.getState().pendingElicitationBySessionId[firstSessionId]
      ).toBeUndefined();
      expect(
        store.getState().chatStatusBySessionId[firstSessionId]
      ).toBeUndefined();
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

  describe("setPosition", () => {
    it("defaults to the pinned side panel", () => {
      const store = createAgentStore();

      expect(store.getState().position).toBe("pinned");
    });

    it("updates the panel display mode", () => {
      const store = createAgentStore();

      store.getState().setPosition("detached");

      expect(store.getState().position).toBe("detached");
    });
  });

  describe("setFabPlacement", () => {
    it("updates the pinned FAB corner", () => {
      const store = createAgentStore();

      store.getState().setFabPlacement("top-start");

      expect(store.getState().fabPlacement).toBe("top-start");
    });
  });

  describe("observability", () => {
    it("updates observability settings without clobbering other fields", () => {
      const store = createAgentStore();

      store.getState().setObservability({
        exportRemoteTraces: false,
      });

      expect(store.getState().observability).toEqual({
        storeLocalTraces: true,
        exportRemoteTraces: false,
        hasAcknowledgedConsent: false,
      });
      expect(store.getState().fabPlacement).toBe("bottom-end");
    });

    it("acknowledges consent without changing trace toggles", () => {
      const store = createAgentStore();

      store.getState().setObservability({
        storeLocalTraces: false,
        exportRemoteTraces: true,
      });
      store.getState().acknowledgeConsent();

      expect(store.getState().observability).toEqual({
        storeLocalTraces: false,
        exportRemoteTraces: true,
        hasAcknowledgedConsent: true,
      });
    });
  });

  describe("setCapability", () => {
    it("updates one capability without clobbering the others", () => {
      const store = createAgentStore();
      const defaultCapabilities = createDefaultAgentCapabilities();
      const [capabilityToToggle] = Object.keys(defaultCapabilities) as Array<
        keyof typeof defaultCapabilities
      >;

      store.getState().setCapability({
        key: capabilityToToggle,
        enabled: true,
      });

      expect(store.getState().capabilities[capabilityToToggle]).toBe(true);

      for (const [capabilityKey, enabled] of Object.entries(
        defaultCapabilities
      ) as Array<[keyof typeof defaultCapabilities, boolean]>) {
        if (capabilityKey === capabilityToToggle) {
          continue;
        }

        expect(store.getState().capabilities[capabilityKey]).toBe(enabled);
      }
    });
  });

  describe("persist migration", () => {
    it("migrates legacy debug flags into capabilities", async () => {
      localStorage.setItem(
        "arize-phoenix-agent",
        JSON.stringify({
          state: {
            isOpen: false,
            position: "detached",
            sessions: [],
            activeSessionId: null,
            sessionMap: {},
            defaultModelConfig: {
              provider: "ANTHROPIC",
              modelName: "claude-opus-4-6",
              invocationParameters: [],
              supportedInvocationParameters: [],
            },
            debug: {
              retainInactiveBashSessions: true,
              dangerouslyEnableMutations: true,
            },
          },
          version: 1,
        })
      );

      const store = createAgentStore();
      await store.persist.rehydrate();

      expect(store.getState().capabilities).toEqual({
        ...createDefaultAgentCapabilities(),
        "bash.retainInactiveSessions": true,
        "graphql.mutations": true,
        "session.storeSessions": false,
        "web.access": false,
      });
      expect(store.getState().observability).toEqual({
        storeLocalTraces: true,
        exportRemoteTraces: false,
        hasAcknowledgedConsent: false,
      });
    });

    it("drops legacy pending prompt edits during migration", async () => {
      localStorage.setItem(
        "arize-phoenix-agent",
        JSON.stringify({
          state: {
            sessions: [],
            sessionMap: {},
            pendingPromptEditsByToolCallId: {
              "tool-call-1": {
                toolCallId: "tool-call-1",
                sessionId: "session-1",
                instanceId: 0,
                expectedRevision: "prompt-old",
                before: { messages: [] },
                after: { messages: [] },
                operations: [],
              },
            },
          },
          version: 5,
        })
      );

      const store = createAgentStore();
      await store.persist.rehydrate();

      expect(store.getState().pendingPromptEditsByToolCallId).toEqual({});
    });

    it("migrates legacy detached position to pinned", async () => {
      localStorage.setItem(
        "arize-phoenix-agent",
        JSON.stringify({
          state: {
            position: "detached",
            sessions: [],
            sessionMap: {},
          },
          version: 7,
        })
      );

      const store = createAgentStore();
      await store.persist.rehydrate();

      expect(store.getState().position).toBe("pinned");
    });
  });
});
