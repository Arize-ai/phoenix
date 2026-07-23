import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  createDefaultAgentCapabilities,
  type AgentCapabilities,
} from "@phoenix/agent/extensions/capabilities";

import {
  createAgentStore,
  DRAFT_SESSION_ID,
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

  describe("setActiveSession", () => {
    it("activates the given session id", () => {
      const store = createAgentStore();
      store.getState().setActiveSession("session-node-id");
      expect(store.getState().activeSessionId).toBe("session-node-id");
    });

    it("activates the draft surface sentinel", () => {
      const store = createAgentStore();
      store.getState().setActiveSession(DRAFT_SESSION_ID);
      expect(store.getState().activeSessionId).toBe(DRAFT_SESSION_ID);
    });
  });

  describe("agentsConfig", () => {
    it("defaults session retention to off", () => {
      const store = createAgentStore();

      expect(
        store.getState().agentsConfig.sessionRetentionMaxIdleDays
      ).toBeNull();
      expect(
        store.getState().agentsConfig.sessionRetentionMaxCountPerUser
      ).toBeNull();
    });
  });

  describe("setIsDraftSessionTemporary", () => {
    it("toggles whether the draft becomes temporary", () => {
      const store = createAgentStore();

      expect(store.getState().isDraftSessionTemporary).toBe(false);
      store.getState().setIsDraftSessionTemporary(true);
      expect(store.getState().isDraftSessionTemporary).toBe(true);
    });
  });

  describe("defaultTemporaryChat", () => {
    it("defaults to false", () => {
      const store = createAgentStore();

      expect(store.getState().defaultTemporaryChat).toBe(false);
      expect(store.getState().isDraftSessionTemporary).toBe(false);
    });

    it("updates the preference without touching the live draft toggle", () => {
      const store = createAgentStore();

      store.getState().setDefaultTemporaryChat(true);
      expect(store.getState().defaultTemporaryChat).toBe(true);
      // The already-open draft is not retroactively flipped.
      expect(store.getState().isDraftSessionTemporary).toBe(false);
    });

    it("seeds the initial draft toggle from the persisted preference", () => {
      localStorage.setItem(
        resolveAssistantStorageKey(),
        JSON.stringify({
          state: { defaultTemporaryChat: true },
          version: 0,
        })
      );

      const store = createAgentStore();

      expect(store.getState().defaultTemporaryChat).toBe(true);
      expect(store.getState().isDraftSessionTemporary).toBe(true);
    });

    it("falls back to false when no preference was persisted", () => {
      localStorage.setItem(
        resolveAssistantStorageKey(),
        JSON.stringify({
          state: { position: "detached" },
          version: 0,
        })
      );

      const store = createAgentStore();

      expect(store.getState().defaultTemporaryChat).toBe(false);
      expect(store.getState().isDraftSessionTemporary).toBe(false);
    });
  });

  describe("clearSessionEphemeralState", () => {
    it("drops a session's pending patch, draft input, pending message, and chat status", () => {
      const store = createAgentStore();
      const sessionId = "session-node-id";
      store.getState().setPendingPatchExperiment("tool-call-1", {
        toolCallId: "tool-call-1",
        sessionId,
        experimentId: "exp-1",
        experimentName: "baseline",
        expectedUpdatedAt: "2026-06-10T00:00:00Z",
        payload: { name: "renamed" },
        diff: [{ field: "name", previous: "baseline", next: "renamed" }],
      });
      store.getState().setDraftInput(sessionId, "hello");
      store
        .getState()
        .setPendingMessage(sessionId, { text: "hi", requestedSkills: [] });
      store.getState().setSessionChatStatus(sessionId, "streaming");

      store.getState().clearSessionEphemeralState(sessionId);

      const state = store.getState();
      expect(
        state.pendingPatchExperimentsByToolCallId["tool-call-1"]
      ).toBeUndefined();
      expect(state.draftInputBySessionId[sessionId]).toBeUndefined();
      expect(state.pendingMessageBySessionId[sessionId]).toBeUndefined();
      expect(state.chatStatusBySessionId[sessionId]).toBeUndefined();
    });

    it("keeps ephemeral state belonging to other sessions", () => {
      const store = createAgentStore();
      store.getState().setDraftInput("session-a", "keep me");
      store.getState().setDraftInput("session-b", "drop me");

      store.getState().clearSessionEphemeralState("session-b");

      expect(store.getState().draftInputBySessionId["session-a"]).toBe(
        "keep me"
      );
      expect(
        store.getState().draftInputBySessionId["session-b"]
      ).toBeUndefined();
    });
  });

  describe("setSessionResponsePending", () => {
    it("removes settled sessions from the sparse pending lookup", () => {
      const store = createAgentStore();

      store.getState().setSessionResponsePending("session-node-id", true);
      expect(
        store.getState().isResponsePendingBySessionId["session-node-id"]
      ).toBe(true);

      store.getState().setSessionResponsePending("session-node-id", false);
      expect(
        store.getState().isResponsePendingBySessionId["session-node-id"]
      ).toBeUndefined();
    });

    it("drops a session's pending response flag when its ephemeral state is cleared", () => {
      const store = createAgentStore();
      store.getState().setSessionResponsePending("session-node-id", true);

      store.getState().clearSessionEphemeralState("session-node-id");

      expect(
        store.getState().isResponsePendingBySessionId["session-node-id"]
      ).toBeUndefined();
    });
  });

  describe("setSessionCompactionPending", () => {
    it("tracks compaction across remounts and clears it with session state", () => {
      const store = createAgentStore();

      store.getState().setSessionCompactionPending("session-node-id", true);
      expect(
        store.getState().isCompactionPendingBySessionId["session-node-id"]
      ).toBe(true);

      store.getState().clearSessionEphemeralState("session-node-id");
      expect(
        store.getState().isCompactionPendingBySessionId["session-node-id"]
      ).toBeUndefined();
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

    it("drops a session draft when its ephemeral state is cleared", () => {
      const store = createAgentStore();
      store.getState().setDraftInput("session-1", "hello");

      store.getState().clearSessionEphemeralState("session-1");

      expect(
        store.getState().draftInputBySessionId["session-1"]
      ).toBeUndefined();
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

    it("drops a pending message when its session's ephemeral state is cleared", () => {
      const store = createAgentStore();
      store
        .getState()
        .setPendingMessage("session-1", { text: "hi", requestedSkills: [] });
      store.getState().clearSessionEphemeralState("session-1");
      expect(store.getState().consumePendingMessage("session-1")).toBeNull();
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

  describe("setFabMode", () => {
    it("defaults to the pinned top-nav button", () => {
      const store = createAgentStore();

      expect(store.getState().fabMode).toBe("pinned");
    });

    it("switches the assistant button to floating", () => {
      const store = createAgentStore();

      store.getState().setFabMode("floating");

      expect(store.getState().fabMode).toBe("floating");
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
          sessionRetentionMaxIdleDays: 30,
          sessionRetentionMaxCountPerUser: null,
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
          sessionRetentionMaxIdleDays: 30,
          sessionRetentionMaxCountPerUser: null,
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
