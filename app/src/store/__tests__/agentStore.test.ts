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
import type { AgentState } from "../agentStore";

installTestStorage();

type PendingToolStateCase = {
  name: string;
  set: (state: AgentState, toolCallId: string, sessionId: string) => void;
  get: (state: AgentState, toolCallId: string, sessionId: string) => unknown;
};

const pendingToolStateCases: PendingToolStateCase[] = [
  {
    name: "elicitation",
    set: (state, toolCallId, sessionId) =>
      state.setPendingElicitation(sessionId, {
        toolCallId,
        sessionId,
      } as never),
    get: (state, _toolCallId, sessionId) =>
      state.pendingElicitationBySessionId[sessionId],
  },
  ...[
    ["prompt edit", "setPendingPromptEdit", "pendingPromptEditsByToolCallId"],
    [
      "prompt removal",
      "setPendingPromptInstanceRemoval",
      "pendingPromptInstanceRemovalsByToolCallId",
    ],
    [
      "batch span annotation",
      "setPendingBatchSpanAnnotate",
      "pendingBatchSpanAnnotatesByToolCallId",
    ],
    [
      "dataset write",
      "setPendingDatasetWrite",
      "pendingDatasetWritesByToolCallId",
    ],
    [
      "annotation config write",
      "setPendingAnnotationConfigWrite",
      "pendingAnnotationConfigWritesByToolCallId",
    ],
    [
      "experiment patch",
      "setPendingPatchExperiment",
      "pendingPatchExperimentsByToolCallId",
    ],
    [
      "prompt tool write",
      "setPendingPromptToolWrite",
      "pendingPromptToolWritesByToolCallId",
    ],
    ["save prompt", "setPendingSavePrompt", "pendingSavePromptsByToolCallId"],
    [
      "code evaluator edit",
      "setPendingCodeEvaluatorEdit",
      "pendingCodeEvaluatorEditsByToolCallId",
    ],
    [
      "LLM evaluator edit",
      "setPendingLlmEvaluatorEdit",
      "pendingLlmEvaluatorEditsByToolCallId",
    ],
    [
      "load dataset",
      "setPendingLoadDataset",
      "pendingLoadDatasetsByToolCallId",
    ],
  ].map(([name, setterName, recordName]) => ({
    name,
    set: (state: AgentState, toolCallId: string, sessionId: string) => {
      const setter = state[setterName as keyof AgentState] as (
        toolCallId: string,
        value: never
      ) => void;
      setter(toolCallId, { toolCallId, sessionId } as never);
    },
    get: (state: AgentState, toolCallId: string) => {
      const record = state[recordName as keyof AgentState] as Partial<
        Record<string, unknown>
      >;
      return record[toolCallId];
    },
  })),
];

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
    it("creates a local draft and sets it as active", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      const state = store.getState();
      expect(state.activeSessionId).toBe(sessionId);
      expect(state.draftSessionId).toBe(sessionId);
      expect(state.sessionStateById[sessionId]).toBeDefined();
    });

    it("promotes a draft to the canonical Relay ID and rekeys UI state", () => {
      const store = createAgentStore();
      const draftSessionId = store.getState().createSession();
      store.getState().setDraftInput(draftSessionId, "hello");
      store.getState().setPendingMessage(draftSessionId, {
        text: "continue",
        requestedSkills: ["debug"],
      });

      store.getState().promoteSession(draftSessionId, "QWdlbnRTZXNzaW9uOjE=");

      const state = store.getState();
      expect(state.activeSessionId).toBe("QWdlbnRTZXNzaW9uOjE=");
      expect(state.draftSessionId).toBeNull();
      expect(state.sessionStateById[draftSessionId]).toBeUndefined();
      expect(state.sessionStateById["QWdlbnRTZXNzaW9uOjE="]).toBeDefined();
      expect(state.draftInputBySessionId["QWdlbnRTZXNzaW9uOjE="]).toBe("hello");
      expect(state.pendingMessageBySessionId["QWdlbnRTZXNzaW9uOjE="]).toEqual({
        text: "continue",
        requestedSkills: ["debug"],
      });
    });
  });

  describe("deleteSession", () => {
    it("removes session and clears activeSessionId when no sessions remain", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      store.getState().deleteSession(sessionId);
      const state = store.getState();
      expect(state.sessionStateById[sessionId]).toBeUndefined();
      expect(state.activeSessionId).toBeNull();
    });

    it("falls back activeSessionId to last remaining session when active is deleted", () => {
      const store = createAgentStore();
      store.getState().cacheSession("QWdlbnRTZXNzaW9uOjE=");
      const draftSessionId = store.getState().createSession();
      store.getState().deleteSession(draftSessionId);
      expect(store.getState().activeSessionId).toBe("QWdlbnRTZXNzaW9uOjE=");
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
      const draftSessionId = store.getState().createSession();
      const firstSessionId = "QWdlbnRTZXNzaW9uOjE=";
      store.getState().promoteSession(draftSessionId, firstSessionId);
      setPendingPatch(store, "tool-call-1", firstSessionId);

      // Sessions persist server-side; creating a new one no longer drops the
      // first session or its pending tool state.
      store.getState().createSession();

      expect(
        store.getState().pendingPatchExperimentsByToolCallId["tool-call-1"]
      ).toBeDefined();
    });
  });

  describe("pending tool-state cleanup", () => {
    it.each(pendingToolStateCases)(
      "clears $name by owning session and by dropped tool call",
      ({ set, get }) => {
        const sessionStore = createAgentStore();
        set(sessionStore.getState(), "session-tool", "session-1");
        sessionStore
          .getState()
          .clearPendingToolState({ sessionId: "session-1" });
        expect(
          get(sessionStore.getState(), "session-tool", "session-1")
        ).toBeUndefined();

        const rewindStore = createAgentStore();
        set(rewindStore.getState(), "rewound-tool", "session-2");
        rewindStore
          .getState()
          .clearPendingToolState({ toolCallIds: ["rewound-tool"] });
        expect(
          get(rewindStore.getState(), "rewound-tool", "session-2")
        ).toBeUndefined();
      }
    );
  });

  describe("updateSessionModelConfig", () => {
    it("partial-merges model config without clobbering other fields", () => {
      const store = createAgentStore();
      const sessionId = store.getState().createSession();
      const originalProvider =
        store.getState().sessionStateById[sessionId].modelConfig.provider;
      store
        .getState()
        .updateSessionModelConfig(sessionId, { modelName: "gpt-4o" });
      const config = store.getState().sessionStateById[sessionId].modelConfig;
      expect(config.modelName).toBe("gpt-4o");
      expect(config.provider).toBe(originalProvider);
    });
  });

  describe("session retention", () => {
    it("replaces a previous unpersisted draft when creating a new session", () => {
      const store = createAgentStore();
      const firstSessionId = store.getState().createSession();
      const secondSessionId = store.getState().createSession();

      expect(store.getState().activeSessionId).toBe(secondSessionId);
      expect(store.getState().draftSessionId).toBe(secondSessionId);
      expect(store.getState().sessionStateById[firstSessionId]).toBeUndefined();
    });

    it("switches canonical sessions without moving their ephemeral state", () => {
      const store = createAgentStore();
      store.getState().cacheSession("QWdlbnRTZXNzaW9uOjE=");
      store.getState().cacheSession("QWdlbnRTZXNzaW9uOjI=");
      store.getState().setDraftInput("QWdlbnRTZXNzaW9uOjE=", "first draft");

      store.getState().setActiveSession("QWdlbnRTZXNzaW9uOjE=");
      store.getState().setActiveSession("QWdlbnRTZXNzaW9uOjI=");

      expect(store.getState().activeSessionId).toBe("QWdlbnRTZXNzaW9uOjI=");
      expect(
        store.getState().draftInputBySessionId["QWdlbnRTZXNzaW9uOjE="]
      ).toBe("first draft");
    });
  });

  describe("cacheSession", () => {
    it("adds server-loaded metadata to the runtime cache", () => {
      const store = createAgentStore();
      store.getState().cacheSession("remote-node-id");

      const state = store.getState();
      expect(state.sessionStateById["remote-node-id"]).toMatchObject({
        context: [],
      });
      expect(state.activeSessionId).toBeNull();
    });

    it("does not replace existing ephemeral state during transcript handoff", () => {
      const store = createAgentStore();
      const localSessionId = store.getState().createSession();
      store.getState().addSessionContext(localSessionId, "span:123");

      store.getState().cacheSession(localSessionId);

      const state = store.getState();
      const localSession = state.sessionStateById[localSessionId];
      expect(localSession?.context).toEqual(["span:123"]);
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
      const draftSessionId = store.getState().createSession();
      const firstSessionId = "QWdlbnRTZXNzaW9uOjE=";
      store.getState().promoteSession(draftSessionId, firstSessionId);
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
