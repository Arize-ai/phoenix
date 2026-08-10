import type { Chat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useRelayEnvironment } from "react-relay";

import { isRequestActive } from "@phoenix/agent/chat/chatUtils";
import { getTurnClientState } from "@phoenix/agent/chat/createAgentSessionChat";
import { cleanupResolvedPendingToolState } from "@phoenix/agent/chat/pendingToolStateCleanup";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { useInterval } from "@phoenix/hooks/useInterval";

import {
  fetchAgentSessionSyncState,
  refetchAgentSession,
  type AgentSessionSyncState,
} from "./agentSessionRelay";

const SESSION_POLL_INTERVAL_MS = 10_000;
const SESSION_BUSY_POLL_INTERVAL_MS = 3000;

/**
 * The persisted transcript's tail as of this client's last full fetch.
 * Polling probes the cheap sync state first and skips the full transcript
 * fetch while the tail hasn't moved, so idle sessions cost a tiny metadata
 * read instead of re-downloading every message.
 */
export type LastSyncedSessionState = AgentSessionSyncState & {
  sessionId: string;
};

/**
 * Keeps a persisted session's runtime chat synchronized with turns completed
 * by other clients, and derives busy-elsewhere mode from the session's
 * canonical Relay record.
 *
 * Each poll tick fetches the cheap sync probe (isActive + transcript tail)
 * and only refetches the full transcript when the tail has moved since this
 * client's last full fetch. This client's own generation disables polling so
 * an older persisted transcript cannot replace its in-flight optimistic
 * messages. Refetching through Relay normalizes session metadata into every
 * mounted view as well as refreshing this chat runtime.
 */
export function useAgentSessionSync({
  persistedSessionId,
  chatInstance,
  chatStatus,
  isActive,
  isCompacting,
  isBusyElsewhere,
  shouldSyncOnMount,
  lastSyncedSessionStateRef,
}: {
  /** The session's Relay node ID, or null for a not-yet-persisted draft. */
  persistedSessionId: string | null;
  /** The runtime-owned chat instance for the session, once one exists. */
  chatInstance: Chat<AgentUIMessage> | null;
  /** The chat status observed by the currently bound surface. */
  chatStatus: ChatStatus;
  /**
   * Relay-derived turn-lock state from the session's canonical record:
   * another client's turn currently holds the session's server lock.
   */
  isActive: boolean;
  /** A compaction request is running for the session. */
  isCompacting: boolean;
  /** The session is in busy-elsewhere mode; polls on the faster cadence. */
  isBusyElsewhere: boolean;
  /** Immediately synchronize runtimes that mounted without a fresh session query. */
  shouldSyncOnMount: boolean;
  /**
   * Owned by the caller because the chat factory's turn-completion refetch
   * also records the tail (via `onTranscriptSynced`) so this hook's probe can
   * recognize the client's own turn and skip the full fetch.
   */
  lastSyncedSessionStateRef: RefObject<LastSyncedSessionState | null>;
}): void {
  const store = useAgentStore();
  const relayEnvironment = useRelayEnvironment();
  const shouldSyncOnNextPollSetupRef = useRef(shouldSyncOnMount);
  /** Prevents overlapping poll requests on slow networks. */
  const isPollInFlightRef = useRef(false);

  // Turn-lock entry: the session's Relay record (fetched network-only when a
  // session surface binds, and refreshed after each completed turn) is the
  // source of truth for whether another client's turn holds the server lock.
  // Deriving from it means opening a locked session enters busy-elsewhere mode
  // without a separate imperative status check.
  useEffect(() => {
    if (!persistedSessionId || !chatInstance || !isActive) {
      return;
    }
    const state = store.getState();
    // Never treat this client's own in-flight turn as busy elsewhere.
    if (
      state.isBusyElsewhereBySessionId[persistedSessionId] !== true &&
      !isRequestActive(chatInstance.status)
    ) {
      state.setSessionBusyElsewhere(persistedSessionId, true);
    }
  }, [persistedSessionId, chatInstance, isActive, store]);

  const isSessionPollingPaused = isRequestActive(chatStatus) || isCompacting;

  const pollSession = useCallback(async () => {
    if (!persistedSessionId || !chatInstance || isPollInFlightRef.current) {
      return;
    }
    isPollInFlightRef.current = true;
    try {
      const syncState = await fetchAgentSessionSyncState({
        environment: relayEnvironment,
        sessionId: persistedSessionId,
      });
      if (!syncState) {
        return;
      }
      shouldSyncOnNextPollSetupRef.current = false;
      if (syncState.isActive) {
        store.getState().setSessionBusyElsewhere(persistedSessionId, true);
        return;
      }
      // Read busy state fresh from the store: the probe may have set it on a
      // previous tick and this closure could be stale.
      const wasBusyElsewhere =
        store.getState().isBusyElsewhereBySessionId[persistedSessionId] ??
        false;
      const lastSynced = lastSyncedSessionStateRef.current;
      const isTranscriptUnchanged =
        lastSynced != null &&
        lastSynced.sessionId === persistedSessionId &&
        lastSynced.updatedAt === syncState.updatedAt &&
        lastSynced.lastMessageId === syncState.lastMessageId;
      if (isTranscriptUnchanged && !wasBusyElsewhere) {
        return;
      }
      const data = await refetchAgentSession({
        environment: relayEnvironment,
        sessionId: persistedSessionId,
      });
      const agentSession =
        data?.agentSession.__typename === "AgentSession"
          ? data.agentSession
          : null;
      if (!agentSession) {
        return;
      }
      if (agentSession.isActive) {
        // Another client claimed the turn lock between the probe and the
        // full fetch; treat this tick as busy and let the next tick resync.
        store.getState().setSessionBusyElsewhere(persistedSessionId, true);
        return;
      }
      // This client started its own turn (or a compaction) while the fetch
      // was in flight; never replace its in-flight optimistic messages.
      if (
        isRequestActive(chatInstance.status) ||
        (store.getState().isCompactionPendingBySessionId[persistedSessionId] ??
          false)
      ) {
        return;
      }
      // Clear a lingering conflict error only after the other client's turn
      // has completed; the SDK can assign error state after onError runs.
      if (wasBusyElsewhere) {
        chatInstance.clearError();
      }
      const syncedMessages = Array.isArray(agentSession.messages)
        ? (agentSession.messages as AgentUIMessage[])
        : [];
      chatInstance.messages = syncedMessages;
      // Another client may have resolved — or interrupted — tool calls this
      // client still shows Accept/Reject affordances for; drop any pending
      // approval state the synced transcript marks as terminal.
      cleanupResolvedPendingToolState(store.getState(), syncedMessages);
      getTurnClientState(chatInstance)?.recoverPendingToolCalls();
      // Record the applied tail (from the full fetch, not the probe: the
      // transcript may have moved again in between) so unchanged idle ticks
      // stop at the probe.
      lastSyncedSessionStateRef.current = {
        sessionId: persistedSessionId,
        updatedAt: agentSession.updatedAt,
        lastMessageId: agentSession.lastMessageId,
      };
      store.getState().setSessionBusyElsewhere(persistedSessionId, false);
    } catch {
      // Transient failure: wait for the next poll tick.
    } finally {
      isPollInFlightRef.current = false;
    }
  }, [
    persistedSessionId,
    chatInstance,
    lastSyncedSessionStateRef,
    relayEnvironment,
    store,
  ]);

  // Poll slowly during normal use and switch to the existing faster cadence
  // while another client holds the turn lock. The visibility-aware interval
  // pauses polling entirely in hidden tabs and fires immediately (with a
  // fresh probe) when the tab becomes visible again.
  const sessionPollDelay =
    !persistedSessionId || !chatInstance || isSessionPollingPaused
      ? null
      : isBusyElsewhere
        ? SESSION_BUSY_POLL_INTERVAL_MS
        : SESSION_POLL_INTERVAL_MS;
  useInterval(() => void pollSession(), sessionPollDelay);

  useEffect(() => {
    if (sessionPollDelay === null) {
      // A runtime first observed during its own generation will be canonicalized
      // by the turn-completion refetch, so it does not also need a mount sync.
      shouldSyncOnNextPollSetupRef.current = false;
      return;
    }
    // Resident runtimes skip the transcript loader when reopened, so refresh
    // those once on mount. Newly seeded runtimes already came from this query.
    if (shouldSyncOnNextPollSetupRef.current) {
      void pollSession();
    }
  }, [sessionPollDelay, pollSession]);
}
