import { AGENT_SYSTEM_PROMPT } from "@phoenix/agent/chat/systemPrompt";
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

  describe("setSystemPrompt", () => {
    it("updates systemPrompt", () => {
      const store = createAgentStore();
      expect(store.getState().systemPrompt).toBe(AGENT_SYSTEM_PROMPT);
      store.getState().setSystemPrompt("custom");
      expect(store.getState().systemPrompt).toBe("custom");
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
      });
    });
  });
});
