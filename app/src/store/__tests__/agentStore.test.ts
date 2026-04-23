import { AGENT_SYSTEM_PROMPT } from "@phoenix/agent/chat/systemPrompt";
import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
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

  describe("advertised contexts", () => {
    it("merges route contexts ahead of mounted contexts", () => {
      const store = createAgentStore();
      const routeContexts: AgentContext[] = [
        { type: "project", projectId: "P1" },
        { type: "trace", projectId: "P1", traceId: "T1" },
      ];

      store.getState().setRouteContexts(routeContexts);
      store.getState().setMountedContext("filter", {
        type: "span_filter",
        projectId: "P1",
        condition: "status_code == 'ERROR'",
      });

      expect(store.getState().routeContexts).toEqual(routeContexts);
      expect(Object.values(store.getState().mountedContexts)).toEqual([
        {
          type: "span_filter",
          projectId: "P1",
          condition: "status_code == 'ERROR'",
        },
      ]);
    });

    it("skips route updates when the logical context list is unchanged", () => {
      const store = createAgentStore();
      const contexts: AgentContext[] = [{ type: "project", projectId: "P1" }];

      store.getState().setRouteContexts(contexts);
      const first = store.getState().routeContexts;
      store.getState().setRouteContexts([{ type: "project", projectId: "P1" }]);

      expect(store.getState().routeContexts).toBe(first);
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
      expect(store.getState().observability).toEqual({
        storeLocalTraces: true,
        exportRemoteTraces: false,
        hasAcknowledgedConsent: false,
      });
    });
  });
});
