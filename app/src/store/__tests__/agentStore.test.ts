import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  createDefaultAgentCapabilities,
  type AgentCapabilities,
} from "@phoenix/agent/extensions/capabilities";

import {
  createAgentStore,
  getEffectiveAttachUserId,
  getEffectiveTraceRecordingSettings,
  hasAcknowledgedCurrentTraceConsent,
  resolveAssistantStorageKey,
} from "../agentStore";

installTestStorage();

describe("agentStore", () => {
  beforeEach(() => {
    localStorage.removeItem("arize-phoenix-assistant");
  });

  describe("resolveAssistantStorageKey", () => {
    const originalBasename = window.Config.basename;
    afterEach(() => {
      window.Config.basename = originalBasename;
    });

    it("uses the base unscoped key when there is no root path", () => {
      window.Config.basename = "/";
      expect(resolveAssistantStorageKey()).toBe("arize-phoenix-assistant");
      window.Config.basename = "";
      expect(resolveAssistantStorageKey()).toBe("arize-phoenix-assistant");
    });

    it("scopes the key to the deployment root path", () => {
      window.Config.basename = "/s/phoenix-devs";
      expect(resolveAssistantStorageKey()).toBe(
        "arize-phoenix-assistant:/s/phoenix-devs"
      );
      // Trailing slashes are normalized so the key is stable.
      window.Config.basename = "/s/phoenix-devs/";
      expect(resolveAssistantStorageKey()).toBe(
        "arize-phoenix-assistant:/s/phoenix-devs"
      );
    });
  });

  describe("createSession", () => {
    it("creates a session, adds it to sessions list, and sets it as active", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      const state = store.getState();
      expect(state.sessions).toEqual([sessionId]);
      expect(state.activeSessionId).toBe(sessionId);
      expect(state.sessionMap[sessionId]).toMatchObject({
        clientKey: sessionId,
        id: null,
      });
    });

    it("marks a local draft persisted without replacing its runtime state", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();

      store.getState().setSessionPersisted(sessionId, "session-node-id");

      expect(store.getState().sessionMap[sessionId]?.id).toBe(
        "session-node-id"
      );
      expect(store.getState().sessionMap[sessionId]?.clientKey).toBe(sessionId);
      expect(store.getState().activeSessionId).toBe(sessionId);
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

  describe("pendingPatchExperiment cleanup", () => {
    function setPendingPatch(
      store: ReturnType<typeof createAgentStore>,
      toolCallId: string,
      sessionId: string
    ) {
      store.getState().setPendingPatchExperiment(toolCallId, {
        toolCallId,
        sessionId,
        experimentId: "exp-1",
        experimentName: "baseline",
        expectedUpdatedAt: "2026-06-10T00:00:00Z",
        payload: { name: "renamed" },
        diff: [{ field: "name", previous: "baseline", next: "renamed" }],
      });
    }

    it("drops a session's pending patch when that session is deleted", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      setPendingPatch(store, "tool-call-1", sessionId);

      store.getState().deleteSession(sessionId);

      expect(
        store.getState().pendingPatchExperimentsByToolCallId["tool-call-1"]
      ).toBeUndefined();
    });

    it("clears all pending patches when all sessions are cleared", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      setPendingPatch(store, "tool-call-1", sessionId);

      store.getState().clearAllSessions();

      expect(store.getState().pendingPatchExperimentsByToolCallId).toEqual({});
    });

    it("keeps pending patches for retained sessions when a new session is created", () => {
      const store = createAgentStore();
      const firstSessionId = store.getState().createSession();
      setPendingPatch(store, "tool-call-1", firstSessionId);

      // Sessions persist server-side; creating a new one no longer drops the
      // first session or its pending tool state.
      store.getState().createSession();

      expect(
        store.getState().pendingPatchExperimentsByToolCallId["tool-call-1"]
      ).toBeDefined();
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
    it("retains prior sessions when creating a new session", () => {
      const store = createAgentStore();
      const firstSessionId = store.getState().createSession();
      const secondSessionId = store.getState().createSession();

      expect(store.getState().sessions).toEqual([
        firstSessionId,
        secondSessionId,
      ]);
      expect(store.getState().activeSessionId).toBe(secondSessionId);
      expect(store.getState().sessionMap[firstSessionId]).toBeDefined();
    });
  });

  describe("cacheSession", () => {
    it("adds a server-loaded transcript to the runtime cache", () => {
      const store = createAgentStore();
      store.getState().cacheSession({
        clientKey: "remote",
        id: "remote-node-id",
        title: "remote session",
        messages: [{ id: "m1", role: "user", parts: [] }],
        context: [],
        modelConfig: store.getState().defaultModelConfig,
        createdAt: 1,
      });

      const state = store.getState();
      expect(state.sessions).toEqual(["remote"]);
      expect(state.sessionMap["remote"]).toMatchObject({
        title: "remote session",
        messages: [{ id: "m1", role: "user", parts: [] }],
        createdAt: 1,
      });
      expect(state.activeSessionId).toBeNull();
    });

    it("preserves live messages while backfilling a server title", () => {
      const store = createAgentStore();
      const localSessionId = store.getState().createSession();
      store
        .getState()
        .setSessionMessages(localSessionId, [
          { id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] },
        ]);

      store.getState().cacheSession({
        clientKey: localSessionId,
        id: "local-node-id",
        title: "server title",
        messages: [],
        context: [],
        modelConfig: store.getState().defaultModelConfig,
        createdAt: 1,
      });

      const state = store.getState();
      expect(state.sessions).toEqual([localSessionId]);
      const localSession = state.sessionMap[localSessionId];
      expect(localSession?.messages).toHaveLength(1);
      expect(localSession?.title).toBe("server title");
    });
  });

  describe("forkSession", () => {
    it("creates a new active session retaining the source session", () => {
      const store = createAgentStore();
      const sourceId = store.getState().createSession();
      const messages = [{ id: "user-1", role: "user" as const, parts: [] }];

      const forkId = store.getState().forkSession({
        sourceSessionId: sourceId,
        messages,
      });

      expect(forkId).not.toBeNull();
      const state = store.getState();
      expect(state.activeSessionId).toBe(forkId);
      // Source session is preserved alongside the fork.
      expect(state.sessionMap[sourceId]).toBeDefined();
      expect(state.sessionMap[forkId!].messages).toEqual(messages);
    });

    it("copies the source session's model config and context", () => {
      const store = createAgentStore();
      const sourceId = store.getState().createSession();
      store
        .getState()
        .updateSessionModelConfig(sourceId, { modelName: "gpt-4o" });
      store.getState().addSessionContext(sourceId, "span:123");

      const forkId = store.getState().forkSession({
        sourceSessionId: sourceId,
        messages: [],
      });

      const forked = store.getState().sessionMap[forkId!];
      expect(forked.modelConfig.modelName).toBe("gpt-4o");
      expect(forked.context).toEqual(["span:123"]);
    });

    it("stages restored input as the forked session draft", () => {
      const store = createAgentStore();
      const sourceId = store.getState().createSession();

      const forkId = store.getState().forkSession({
        sourceSessionId: sourceId,
        messages: [],
        restoredInput: "edit me",
      });

      expect(store.getState().draftInputBySessionId[forkId!]).toBe("edit me");
    });

    it("prefixes the source title with (branch)", () => {
      const store = createAgentStore();
      const sourceId = store.getState().createSession();
      store.getState().updateSessionTitle(sourceId, "Debugging traces");

      const forkId = store.getState().forkSession({
        sourceSessionId: sourceId,
        messages: [],
      });

      expect(store.getState().sessionMap[forkId!].title).toBe(
        "(branch) Debugging traces"
      );
    });

    it("derives the fork title from the first user message when the source is untitled", () => {
      const store = createAgentStore();
      const sourceId = store.getState().createSession();

      const forkId = store.getState().forkSession({
        sourceSessionId: sourceId,
        messages: [
          {
            id: "user-1",
            role: "user" as const,
            parts: [{ type: "text" as const, text: "How do I trace OpenAI?" }],
          },
        ],
      });

      // The source session still has the messages too (fork copies them), but
      // here we assert the fork derives its own label from its messages.
      store.getState().setSessionMessages(sourceId, [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "How do I trace OpenAI?" }],
        },
      ]);
      const refork = store.getState().forkSession({
        sourceSessionId: sourceId,
        messages: [],
      });
      expect(store.getState().sessionMap[refork!].title).toBe(
        "(branch) How do I trace OpenAI?"
      );
      expect(forkId).not.toBeNull();
    });

    it("does not stack the (branch) prefix when branching from a branch", () => {
      const store = createAgentStore();
      const sourceId = store.getState().createSession();
      store.getState().updateSessionTitle(sourceId, "(branch) Original");

      const forkId = store.getState().forkSession({
        sourceSessionId: sourceId,
        messages: [],
      });

      expect(store.getState().sessionMap[forkId!].title).toBe(
        "(branch) Original"
      );
    });

    it("returns null and no-ops for an unknown source session", () => {
      const store = createAgentStore();
      const before = store.getState().sessions;

      const forkId = store.getState().forkSession({
        sourceSessionId: "missing",
        messages: [],
      });

      expect(forkId).toBeNull();
      expect(store.getState().sessions).toBe(before);
    });
  });

  describe("draft input", () => {
    it("sets and clears draft input", () => {
      const store = createAgentStore();
      store.getState().setDraftInput("session-1", "hello");
      expect(store.getState().draftInputBySessionId["session-1"]).toBe("hello");

      store.getState().setDraftInput("session-1", "");
      expect(store.getState().draftInputBySessionId["session-1"]).toBe(
        undefined
      );
    });

    it("clears draft input when set to null", () => {
      const store = createAgentStore();
      store.getState().setDraftInput("session-1", "hello");
      store.getState().setDraftInput("session-1", null);
      expect(store.getState().draftInputBySessionId["session-1"]).toBe(
        undefined
      );
    });

    it("drops a session draft when that session is deleted", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      store.getState().setDraftInput(sessionId, "hello");

      store.getState().deleteSession(sessionId);

      expect(store.getState().draftInputBySessionId[sessionId]).toBeUndefined();
    });

    it("clears all drafts when all sessions are cleared", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      store.getState().setDraftInput(sessionId, "hello");

      store.getState().clearAllSessions();

      expect(store.getState().draftInputBySessionId).toEqual({});
    });

    it("keeps drafts for retained sessions when a new session is created", () => {
      const store = createAgentStore();
      const firstSessionId = store.getState().createSession();
      store.getState().setDraftInput(firstSessionId, "old draft");

      const secondSessionId = store.getState().createSession();
      store.getState().setDraftInput(secondSessionId, "new draft");

      expect(store.getState().draftInputBySessionId[firstSessionId]).toBe(
        "old draft"
      );
      expect(store.getState().draftInputBySessionId[secondSessionId]).toBe(
        "new draft"
      );
    });
  });

  describe("pending message", () => {
    it("sets and consumes a pending message once", () => {
      const store = createAgentStore();
      const message = {
        text: "fix this bug",
        requestedSkills: ["debug-trace"],
      };
      store.getState().setPendingMessage("session-1", message);
      expect(store.getState().consumePendingMessage("session-1")).toEqual(
        message
      );
      expect(store.getState().consumePendingMessage("session-1")).toBeNull();
    });

    it("clears a pending message when set to null", () => {
      const store = createAgentStore();
      store
        .getState()
        .setPendingMessage("session-1", { text: "hi", requestedSkills: [] });
      store.getState().setPendingMessage("session-1", null);
      expect(store.getState().consumePendingMessage("session-1")).toBeNull();
    });

    it("drops a pending message when its session is deleted", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      store
        .getState()
        .setPendingMessage(sessionId, { text: "hi", requestedSkills: [] });
      store.getState().deleteSession(sessionId);
      expect(store.getState().consumePendingMessage(sessionId)).toBeNull();
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
        attachUserId: false,
        acknowledgedTraceConsent: null,
      });
      expect(store.getState().fabPlacement).toBe("bottom-end");
    });

    it("acknowledges consent for the current server trace settings", () => {
      const store = createAgentStore({
        agentsConfig: {
          collectorEndpoint: "https://collector.example.com",
          assistantProjectName: "assistant_agent",
          forceTracing: false,
          webAccessEnabled: false,
          assistantEnabled: true,
          allowLocalTraces: true,
          allowRemoteExport: true,
        },
      });

      store.getState().setObservability({
        storeLocalTraces: false,
        exportRemoteTraces: true,
      });
      store.getState().acknowledgeConsent();

      expect(store.getState().observability).toEqual({
        storeLocalTraces: false,
        exportRemoteTraces: true,
        attachUserId: false,
        acknowledgedTraceConsent: {
          allowLocalTraces: true,
          allowRemoteExport: true,
        },
      });
    });

    it("requires renewed consent when server trace settings broaden", () => {
      const store = createAgentStore();

      store.getState().acknowledgeConsent();
      expect(
        hasAcknowledgedCurrentTraceConsent({
          agentsConfig: store.getState().agentsConfig,
          observability: store.getState().observability,
        })
      ).toBe(true);

      store.getState().setAgentsConfig({ allowLocalTraces: true });

      expect(
        hasAcknowledgedCurrentTraceConsent({
          agentsConfig: store.getState().agentsConfig,
          observability: store.getState().observability,
        })
      ).toBe(false);
    });

    it("forces tracing and bypasses consent when agent debugging is enabled", () => {
      const store = createAgentStore({
        agentsConfig: {
          collectorEndpoint: "https://collector.example.com",
          assistantProjectName: "assistant_agent",
          forceTracing: true,
          webAccessEnabled: false,
          assistantEnabled: true,
          allowLocalTraces: false,
          allowRemoteExport: false,
        },
        observability: {
          storeLocalTraces: false,
          exportRemoteTraces: false,
          attachUserId: false,
          acknowledgedTraceConsent: null,
        },
      });

      expect(
        getEffectiveTraceRecordingSettings({
          agentsConfig: store.getState().agentsConfig,
          observability: store.getState().observability,
        })
      ).toEqual({ ingestTraces: true, exportRemoteTraces: true });
      expect(
        hasAcknowledgedCurrentTraceConsent({
          agentsConfig: store.getState().agentsConfig,
          observability: store.getState().observability,
        })
      ).toBe(true);
      expect(
        getEffectiveAttachUserId({
          agentsConfig: store.getState().agentsConfig,
          observability: store.getState().observability,
        })
      ).toBe(true);
    });
  });

  describe("persisted capabilities", () => {
    it("backfills missing capability keys when rehydrating persisted state", () => {
      const persistedCapabilities: Partial<AgentCapabilities> = {
        "graphql.mutations": true,
        "web.access": true,
      };
      localStorage.setItem(
        resolveAssistantStorageKey(),
        JSON.stringify({
          state: { capabilities: persistedCapabilities },
          version: 0,
        })
      );

      const store = createAgentStore();

      expect(store.getState().capabilities).toEqual({
        ...createDefaultAgentCapabilities(),
        "graphql.mutations": true,
        "web.access": true,
      });
    });
  });

  describe("persisted observability", () => {
    it("backfills missing observability keys when rehydrating persisted state", () => {
      localStorage.setItem(
        resolveAssistantStorageKey(),
        JSON.stringify({
          state: {
            observability: {
              storeLocalTraces: false,
              exportRemoteTraces: true,
              acknowledgedTraceConsent: null,
            },
          },
          version: 0,
        })
      );

      const store = createAgentStore();

      expect(store.getState().observability).toEqual({
        storeLocalTraces: false,
        exportRemoteTraces: true,
        attachUserId: false,
        acknowledgedTraceConsent: null,
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
});
