import { type Chat, useChat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import { getToolName, isToolUIPart } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConnectionHandler,
  graphql,
  useMutation,
  useRelayEnvironment,
} from "react-relay";

import {
  SESSION_BUSY_ERROR_CODE,
  buildAgentChatApiUrl,
  buildAgentCompactApiUrl,
} from "@phoenix/agent/chat/agentChatApi";
import type { AgentChatRequestBodyPatch } from "@phoenix/agent/chat/buildAgentChatRequestBody";
import {
  createAgentSessionChat,
  getTurnClientState,
} from "@phoenix/agent/chat/createAgentSessionChat";
import { getUnresolvedToolCalls } from "@phoenix/agent/chat/interruptToolCalls";
import {
  REWIND_CLEARED_TOOL_NAMES,
  clearPendingToolState,
} from "@phoenix/agent/chat/pendingToolStateClearers";
import { getRemovedUserMessageText } from "@phoenix/agent/chat/removedUserMessageText";
import {
  SYSTEM_INTERRUPT_ERROR,
  USER_INTERRUPT_ERROR,
} from "@phoenix/agent/chat/shouldSendAutomatically";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { buildUserMessageMetadata } from "@phoenix/agent/chat/userMessageMetadata";
import type {
  ElicitToolOutput,
  PendingElicitation,
} from "@phoenix/agent/tools/elicit";
import { authFetch } from "@phoenix/authFetch";
import { useAgentChatRuntime } from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { useInterval } from "@phoenix/hooks/useInterval";
import {
  DRAFT_SESSION_ID,
  type PendingAgentMessage,
} from "@phoenix/store/agentStore";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { useAgentChatBranchAgentSessionMutation } from "./__generated__/useAgentChatBranchAgentSessionMutation.graphql";
import type { useAgentChatCreateAgentSessionMutation } from "./__generated__/useAgentChatCreateAgentSessionMutation.graphql";
import type { useAgentChatTruncateAgentSessionMutation } from "./__generated__/useAgentChatTruncateAgentSessionMutation.graphql";
import {
  AGENT_SESSIONS_CONNECTION_KEY,
  SETTINGS_AGENT_SESSIONS_CONNECTION_KEY,
  fetchAgentSessionSyncState,
  refetchAgentSession,
  type AgentSessionSyncState,
} from "./agentSessionRelay";
import { selectAgentModel } from "./useAgentChatPanelState";

export type AgentChatOperationError = {
  title: string;
  message: string;
};

const SESSION_POLL_INTERVAL_MS = 10_000;
const SESSION_BUSY_POLL_INTERVAL_MS = 3000;

const createAgentSessionMutation = graphql`
  mutation useAgentChatCreateAgentSessionMutation(
    $input: CreateAgentSessionInput!
    $connections: [ID!]!
  ) {
    createAgentSession(input: $input) {
      agentSession
        @prependNode(
          connections: $connections
          edgeTypeName: "AgentSessionEdge"
        ) {
        id
        title
        ...EditAgentSessionTitleDialog_session
        isTemporary: isEphemeral
        createdAt
        updatedAt
        firstInput
        latestOutput
        user {
          username
          profilePictureUrl
        }
      }
    }
  }
`;

const truncateAgentSessionMutation = graphql`
  mutation useAgentChatTruncateAgentSessionMutation(
    $input: TruncateAgentSessionInput!
  ) {
    truncateAgentSession(input: $input) {
      agentSession {
        id
        title
        ...EditAgentSessionTitleDialog_session
        updatedAt
        firstInput
        latestOutput
        user {
          username
          profilePictureUrl
        }
        messages
      }
    }
  }
`;

const branchAgentSessionMutation = graphql`
  mutation useAgentChatBranchAgentSessionMutation(
    $input: BranchAgentSessionInput!
    $connections: [ID!]!
  ) {
    branchAgentSession(input: $input) {
      agentSession
        @prependNode(
          connections: $connections
          edgeTypeName: "AgentSessionEdge"
        ) {
        id
        title
        ...EditAgentSessionTitleDialog_session
        isTemporary: isEphemeral
        createdAt
        updatedAt
        firstInput
        latestOutput
        user {
          username
          profilePictureUrl
        }
        messages
      }
    }
  }
`;

/**
 * Subscribes the current render surface to the persistent AI SDK chat runtime
 * for a single agent session.
 *
 * `useChat` alone is tied to the current mounted component, which is too short-
 * lived for this agent UX: the visible chat surface can move between the docked
 * panel and the trace slideover. This hook keeps the imperative AI SDK `Chat`
 * instance in the app-level runtime registry, then binds the current React
 * surface to whichever runtime instance should own the session right now. The
 * transport reads per-send state (model selection, capabilities, contexts)
 * from the store at request time, so those settings apply to the next send
 * without rebuilding the cached chat.
 *
 * Session lifecycle: sessions are created imperatively on the server. When
 * `sessionId` is the draft sentinel ({@link DRAFT_SESSION_ID}) no server
 * session exists yet; the first send runs the `createAgentSession` mutation,
 * seeds a runtime chat under the returned Relay ID, and activates it. Relay is
 * the durable source of truth for session identity, titles, and transcripts —
 * each completed turn refetches the session node so the store stays canonical.
 */
export function useAgentChat({
  sessionId,
  initialMessages,
  isActive = false,
  shouldSyncOnMount = false,
}: {
  /**
   * The session's Relay node ID, or {@link DRAFT_SESSION_ID} (or null) for a
   * not-yet-persisted new-chat draft.
   */
  sessionId: string | null;
  /** Server transcript used to seed the runtime chat on its first bind. */
  initialMessages?: AgentUIMessage[];
  /**
   * Relay-derived turn-lock state from the session's canonical record:
   * another client's turn currently holds the session's server lock. Drives
   * entry into busy-elsewhere mode; the hook then polls until the lock clears.
   */
  isActive?: boolean;
  /** Immediately synchronize runtimes that mounted without a fresh session query. */
  shouldSyncOnMount?: boolean;
}) {
  const store = useAgentStore();
  const runtime = useAgentChatRuntime();
  const relayEnvironment = useRelayEnvironment();
  const [operationError, setOperationError] =
    useState<AgentChatOperationError | null>(null);
  const shouldSyncOnNextPollSetupRef = useRef(shouldSyncOnMount);
  /**
   * The persisted transcript's tail as of this client's last full fetch.
   * Polling probes the cheap sync state first and skips the full transcript
   * fetch while the tail hasn't moved, so idle sessions cost a tiny metadata
   * read instead of re-downloading every message.
   */
  const lastSyncedSessionStateRef = useRef<
    (AgentSessionSyncState & { sessionId: string }) | null
  >(null);
  /** Prevents overlapping poll requests on slow networks. */
  const isPollInFlightRef = useRef(false);
  const [compactionStatus, setCompactionStatus] = useState<string | null>(null);
  const isDraft = sessionId == null || sessionId === DRAFT_SESSION_ID;
  const isCompacting = useAgentContext((state) =>
    sessionId ? state.isCompactionPendingBySessionId[sessionId] ?? false : false
  );
  const pendingElicitation = useAgentContext((state) =>
    sessionId ? state.pendingElicitationBySessionId[sessionId] ?? null : null
  );
  const isBusyElsewhere = useAgentContext((state) =>
    sessionId ? state.isBusyElsewhereBySessionId[sessionId] ?? false : false
  );

  const [commitCreateAgentSession] =
    useMutation<useAgentChatCreateAgentSessionMutation>(
      createAgentSessionMutation
    );
  const [commitTruncateAgentSession] =
    useMutation<useAgentChatTruncateAgentSessionMutation>(
      truncateAgentSessionMutation
    );
  const [commitBranchAgentSession] =
    useMutation<useAgentChatBranchAgentSessionMutation>(
      branchAgentSessionMutation
    );
  const sessionsConnectionId = ConnectionHandler.getConnectionID(
    "client:root",
    AGENT_SESSIONS_CONNECTION_KEY
  );
  const settingsSessionsConnectionId = ConnectionHandler.getConnectionID(
    "client:root",
    SETTINGS_AGENT_SESSIONS_CONNECTION_KEY
  );
  // Guards the draft surface against double-submits while the create-session
  // mutation is in flight.
  const isCreatingSessionRef = useRef(false);
  // The first message of a draft surface, echoed optimistically (with a
  // "submitted" status, so the Thinking indicator shows) while the
  // create-session mutation round-trip is in flight. The real message is sent
  // through the new session's chat once the mutation returns.
  const [pendingDraftUserMessage, setPendingDraftUserMessage] =
    useState<AgentUIMessage | null>(null);

  /**
   * Builds the imperative AI SDK chat runtime for a persisted session. The
   * factory captures the session's canonical Relay ID, so a draft surface only
   * builds a chat after the create-session mutation returns one.
   */
  const createChatForSession = useCallback(
    (
      targetSessionId: string,
      seedMessages: AgentUIMessage[]
    ): Chat<AgentUIMessage> =>
      createAgentSessionChat({
        sessionId: targetSessionId,
        seedMessages,
        store,
        relayEnvironment,
        onTranscriptSynced: (tail) => {
          // Record the refetched tail so the next poll's sync probe can
          // recognize this client's own turn and skip the full fetch.
          lastSyncedSessionStateRef.current = {
            sessionId: targetSessionId,
            ...tail,
          };
        },
      }),
    [relayEnvironment, store]
  );

  // Resolve the imperative runtime instance for this session/model pair. The
  // runtime owns replacement semantics when the transport changes, while the
  // hook simply binds the current render surface to the selected instance.
  // Draft surfaces have no runtime until the first send creates a session.
  const persistedSessionId = isDraft ? null : sessionId;
  const chatApiUrl = persistedSessionId
    ? buildAgentChatApiUrl(persistedSessionId)
    : null;
  const chatInstance =
    chatApiUrl && persistedSessionId
      ? runtime.getOrCreateChat({
          sessionId: persistedSessionId,
          chatApiUrl,
          createChat: (previousMessages) =>
            createChatForSession(
              persistedSessionId,
              previousMessages ?? initialMessages ?? []
            ),
        })
      : null;

  // `useChat` subscribes the current React tree to the already-created runtime
  // instance. Draft surfaces expose an inert chat shape until the first send.
  const chat = useChat<AgentUIMessage>(
    chatInstance ? { chat: chatInstance } : { id: undefined, messages: [] }
  );
  const {
    messages,
    sendMessage,
    status,
    error,
    addToolOutput,
    stop,
    setMessages,
    clearError,
  } = chat;

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

  const isSessionPollingPaused = isRequestActive(status) || isCompacting;

  // Keep idle sessions synchronized with turns completed by other clients.
  // Each tick fetches the cheap sync probe (isActive + transcript tail) and
  // only refetches the full transcript when the tail has moved since this
  // client's last full fetch. This client's own generation disables polling
  // so an older persisted transcript cannot replace its in-flight optimistic
  // messages. Refetching through Relay normalizes session metadata into every
  // mounted view as well as refreshing this chat runtime.
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
      chatInstance.messages = Array.isArray(agentSession.messages)
        ? (agentSession.messages as AgentUIMessage[])
        : [];
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
  }, [persistedSessionId, chatInstance, relayEnvironment, store]);

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

  // Anthropic doesn't accept unresolved tool calls, so we resolve them by
  // marking them as error before the next request goes out.
  const addInterruptedToolOutputs = async ({
    messages,
    errorText,
  }: {
    messages: AgentUIMessage[];
    errorText: string;
  }) => {
    const unresolvedToolCalls = getUnresolvedToolCalls(messages);

    unresolvedToolCalls.forEach((toolCall) => {
      clearPendingToolState(
        store.getState(),
        toolCall.tool,
        toolCall.toolCallId
      );
    });

    const turnClientState = chatInstance
      ? getTurnClientState(chatInstance)
      : undefined;
    await Promise.all(
      unresolvedToolCalls.map((toolCall) => {
        const toolOutput = {
          tool: toolCall.tool,
          toolCallId: toolCall.toolCallId,
          errorText,
          state: "output-error",
        } as const;
        turnClientState?.toolTimings.recordEnd(toolCall.toolCallId);
        return addToolOutput(toolOutput);
      })
    );
  };

  const handleStopWithToolCleanup = async () => {
    await stop();
    if (sessionId) {
      store.getState().setSessionResponsePending(sessionId, false);
    }
    const latestMessages = chatInstance?.messages ?? messages;
    await addInterruptedToolOutputs({
      messages: latestMessages,
      errorText: USER_INTERRUPT_ERROR,
    });
    if (chatInstance) {
      const turnClientState = getTurnClientState(chatInstance);
      turnClientState?.turnTraceContext.clear();
      turnClientState?.toolTimings.clear();
    }
    setMessages(removeInterruptedToolInputParts);
  };

  /**
   * Creates the server session for a draft surface, then sends the first
   * message through a freshly seeded runtime chat keyed by the new session's
   * Relay ID. Activating the new session re-keys the visible surface.
   */
  const createSessionAndSendMessage = (
    ...args: Parameters<typeof sendMessage>
  ) => {
    const [message, options] = args;
    const text =
      message != null && "text" in message && typeof message.text === "string"
        ? message.text.trim()
        : "";
    if (!text || isCreatingSessionRef.current) {
      return;
    }
    setOperationError(null);
    isCreatingSessionRef.current = true;
    setPendingDraftUserMessage({
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text }],
      metadata: buildUserMessageMetadata(),
    });
    // Pulse the collapsed-surface glyphs (widget, top nav) for the creation
    // wait too; clearSessionEphemeralState removes the flag on success.
    store.getState().setSessionResponsePending(DRAFT_SESSION_ID, true);
    const isTemporary = store.getState().isDraftSessionTemporary;
    commitCreateAgentSession({
      variables: {
        input: { isEphemeral: isTemporary },
        connections: isTemporary
          ? [sessionsConnectionId]
          : [sessionsConnectionId, settingsSessionsConnectionId],
      },
      onCompleted: (response) => {
        isCreatingSessionRef.current = false;
        const newSessionId = response.createAgentSession.agentSession.id;
        const newChatApiUrl = buildAgentChatApiUrl(newSessionId);
        const newChat = runtime.getOrCreateChat({
          sessionId: newSessionId,
          chatApiUrl: newChatApiUrl,
          createChat: (previousMessages) =>
            createChatForSession(newSessionId, previousMessages ?? []),
        });
        void newChat.sendMessage(
          { text, metadata: buildUserMessageMetadata() },
          options
        );
        setPendingDraftUserMessage(null);
        const state = store.getState();
        state.clearSessionEphemeralState(DRAFT_SESSION_ID);
        state.setIsDraftSessionTemporary(state.defaultTemporaryChat);
        state.setActiveSession(newSessionId);
      },
      onError: (mutationError) => {
        isCreatingSessionRef.current = false;
        setPendingDraftUserMessage(null);
        store.getState().setSessionResponsePending(DRAFT_SESSION_ID, false);
        // Give the user their message back to retry.
        store.getState().setDraftInput(DRAFT_SESSION_ID, text);
        const errorMessages =
          getErrorMessagesFromRelayMutationError(mutationError);
        setOperationError({
          title: "Conversation could not be started",
          message: errorMessages?.[0] ?? mutationError.message,
        });
      },
    });
  };

  const handleSendMessage = async (...args: Parameters<typeof sendMessage>) => {
    setCompactionStatus(null);
    if (isDraft) {
      createSessionAndSendMessage(...args);
      return;
    }
    if (chatInstance && isRequestActive(chatInstance.status)) {
      return;
    }

    const latestMessages = chatInstance?.messages ?? messages;
    await addInterruptedToolOutputs({
      messages: latestMessages,
      errorText: SYSTEM_INTERRUPT_ERROR,
    });
    setMessages(removeInterruptedToolInputParts);

    const [message, options] = args;
    await sendMessage(
      message == null
        ? message
        : { ...message, metadata: buildUserMessageMetadata() },
      options
    );
  };

  const compactSession = (pendingMessage?: PendingAgentMessage): void => {
    setOperationError(null);
    setCompactionStatus(null);
    const restorePendingMessage = () => {
      if (pendingMessage && sessionId) {
        store.getState().setDraftInput(sessionId, pendingMessage.text);
      }
    };
    // Shared failure effect for every blocked precondition: hand the user's
    // queued message back to the composer and surface why.
    const failCompaction = (message: string) => {
      restorePendingMessage();
      setOperationError({
        title: "Conversation could not be compacted",
        message,
      });
    };
    if (isDraft || !sessionId || !chatInstance) {
      failCompaction("There is no persisted conversation to compact.");
      return;
    }
    const blockedReason = getCompactionBlockedReason({
      isResponseInProgress: isRequestActive(chatInstance.status),
      isCompactionPending:
        store.getState().isCompactionPendingBySessionId[sessionId] ?? false,
      isBusyElsewhere:
        store.getState().isBusyElsewhereBySessionId[sessionId] ?? false,
    });
    if (blockedReason) {
      failCompaction(blockedReason);
      return;
    }

    store.getState().setSessionCompactionPending(sessionId, true);
    void (async () => {
      try {
        const response = await authFetch(buildAgentCompactApiUrl(sessionId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectAgentModel(store.getState()),
          }),
        });
        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          if (response.status === 409 && isSessionBusyConflict(errorBody)) {
            // Another client's turn holds the session lock: enter
            // busy-elsewhere mode (the poll swaps in the fresh transcript
            // when the turn completes) instead of raising a red error.
            restorePendingMessage();
            store.getState().setSessionBusyElsewhere(sessionId, true);
            return;
          }
          throw new Error(
            getAgentCompactErrorMessage(errorBody, response.status)
          );
        }
        const result: unknown = await response.json();
        const data =
          isRecord(result) && isRecord(result.data) ? result.data : null;
        const wasCompacted =
          data && typeof data.compacted === "boolean" ? data.compacted : false;
        const compactionMessage = getCompactionMessageFromResponse(data);
        if (
          compactionMessage &&
          !chatInstance.messages.some(
            (message) => message.id === compactionMessage.id
          )
        ) {
          chatInstance.messages = [...chatInstance.messages, compactionMessage];
        }
        void refetchAgentSession({
          environment: relayEnvironment,
          sessionId,
        });
        if (!wasCompacted) {
          setCompactionStatus(
            "Conversation is already compact. There are no older complete turns to compact."
          );
        }
        if (pendingMessage) {
          store.getState().setSessionCompactionPending(sessionId, false);
          await handleSendMessage(
            { text: pendingMessage.text },
            pendingMessage.requestedSkills.length > 0
              ? { body: { requestedSkills: pendingMessage.requestedSkills } }
              : undefined
          );
        }
      } catch (error) {
        failCompaction(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred."
        );
      } finally {
        store.getState().setSessionCompactionPending(sessionId, false);
      }
    })();
  };

  // Elicitation responses are written back through the runtime-owned chat so
  // the pending tool call resolves against the correct assistant turn.
  const handleElicitationSubmit = (output: ElicitToolOutput) => {
    if (!pendingElicitation || !sessionId) {
      return;
    }
    if (chatInstance) {
      getTurnClientState(chatInstance)?.toolTimings.recordEnd(
        pendingElicitation.toolCallId
      );
    }
    void addToolOutput({
      tool: "ask_user",
      toolCallId: pendingElicitation.toolCallId,
      output,
    });
    store.getState().setPendingElicitation(sessionId, null);
  };

  const handleElicitationCancel = () => {
    if (!pendingElicitation || !sessionId) {
      return;
    }
    if (chatInstance) {
      getTurnClientState(chatInstance)?.toolTimings.recordEnd(
        pendingElicitation.toolCallId
      );
    }
    void addToolOutput({
      state: "output-error",
      tool: "ask_user",
      toolCallId: pendingElicitation.toolCallId,
      errorText: "User cancelled the question.",
    });
    store.getState().setPendingElicitation(sessionId, null);
  };

  // Releases approval/elicitation state owned by tool calls dropped by a rewind
  // or branch, so stale Accept/Reject affordances don't dangle against tool calls
  // the transcript no longer contains.
  const clearDroppedToolState = useCallback(
    ({
      previous,
      next,
    }: {
      previous: AgentUIMessage[];
      next: AgentUIMessage[];
    }) => {
      if (!sessionId) {
        return;
      }
      const retained = new Set(
        next.flatMap((message) =>
          message.parts.filter(isToolUIPart).map((part) => part.toolCallId)
        )
      );
      const state = store.getState();
      for (const message of previous) {
        for (const part of message.parts) {
          if (!isToolUIPart(part) || retained.has(part.toolCallId)) {
            continue;
          }
          const toolName = getToolName(part);
          if (REWIND_CLEARED_TOOL_NAMES.has(toolName)) {
            clearPendingToolState(state, toolName, part.toolCallId);
          } else if (pendingElicitation?.toolCallId === part.toolCallId) {
            state.setPendingElicitation(sessionId, null);
          }
        }
      }
    },
    [pendingElicitation, sessionId, store]
  );

  // Rewinds the active session in place at the chosen message. The truncation
  // itself runs server-side (`truncateAgentSession`); the runtime chat is then
  // reset to the persisted transcript and stale tool state is released.
  // Resolves to the user message text to restore into the input (user target)
  // or null (assistant target / no-op), and rejects when persistence fails.
  const rewindToMessage = useCallback(
    (messageId: string): Promise<string | null> => {
      if (
        isDraft ||
        !sessionId ||
        !chatInstance ||
        isRequestActive(chatInstance.status)
      ) {
        return Promise.resolve(null);
      }
      // A rewind at a user message removes it; remember its text now so it
      // can be placed back into the prompt input once the truncation lands.
      const restoredInput = getRemovedUserMessageText(
        chatInstance.messages,
        messageId
      );
      return new Promise((resolve, reject) => {
        commitTruncateAgentSession({
          variables: { input: { id: sessionId, messageId } },
          onCompleted: (response) => {
            const payload = response.truncateAgentSession;
            const nextMessages = Array.isArray(payload.agentSession.messages)
              ? (payload.agentSession.messages as AgentUIMessage[])
              : [];
            clearDroppedToolState({
              previous: chatInstance.messages,
              next: nextMessages,
            });
            setMessages(nextMessages);
            clearError();
            resolve(restoredInput);
          },
          onError: (mutationError) => {
            const errorMessages =
              getErrorMessagesFromRelayMutationError(mutationError);
            reject(new Error(errorMessages?.[0] ?? mutationError.message));
          },
        });
      });
    },
    [
      chatInstance,
      clearDroppedToolState,
      clearError,
      commitTruncateAgentSession,
      isDraft,
      sessionId,
      setMessages,
    ]
  );

  // Branches the active session into a new server session truncated at the
  // chosen message, leaving the current session untouched. The server copies
  // the truncated transcript and derives the branch title; the UI seeds a
  // runtime chat from the returned transcript and activates it.
  const forkFromMessage = useCallback(
    (messageId: string): Promise<void> => {
      if (isDraft || !sessionId || !chatInstance) {
        return Promise.resolve();
      }
      clearError();
      // Branching at a user message drops it from the branch; remember its
      // text now so the branch's composer starts with it.
      const restoredInput = getRemovedUserMessageText(
        chatInstance.messages,
        messageId
      );
      return new Promise((resolve, reject) => {
        commitBranchAgentSession({
          variables: {
            input: { id: sessionId, messageId },
            connections: [sessionsConnectionId],
          },
          onCompleted: (response) => {
            const payload = response.branchAgentSession;
            const branchSessionId = payload.agentSession.id;
            const branchChatApiUrl = buildAgentChatApiUrl(branchSessionId);
            const branchMessages = Array.isArray(payload.agentSession.messages)
              ? (payload.agentSession.messages as AgentUIMessage[])
              : [];
            runtime.getOrCreateChat({
              sessionId: branchSessionId,
              chatApiUrl: branchChatApiUrl,
              createChat: (previousMessages) =>
                createChatForSession(
                  branchSessionId,
                  previousMessages ?? branchMessages
                ),
            });
            const state = store.getState();
            if (restoredInput) {
              state.setDraftInput(branchSessionId, restoredInput);
            }
            state.setActiveSession(branchSessionId);
            resolve();
          },
          onError: (mutationError) => {
            const errorMessages =
              getErrorMessagesFromRelayMutationError(mutationError);
            reject(new Error(errorMessages?.[0] ?? mutationError.message));
          },
        });
      });
    },
    [
      chatInstance,
      clearError,
      commitBranchAgentSession,
      createChatForSession,
      isDraft,
      runtime,
      sessionId,
      sessionsConnectionId,
      store,
    ]
  );

  const displayedMessages = useMemo(
    () =>
      pendingDraftUserMessage
        ? [...messages, pendingDraftUserMessage]
        : messages,
    [messages, pendingDraftUserMessage]
  );

  return {
    messages: displayedMessages,
    sendMessage: handleSendMessage,
    stop: handleStopWithToolCleanup,
    status: pendingDraftUserMessage ? "submitted" : status,
    error,
    pendingElicitation,
    handleElicitationSubmit,
    handleElicitationCancel,
    compactSession,
    isCompacting,
    compactionStatus,
    operationError,
    clearOperationError: () => setOperationError(null),
    rewindToMessage,
    forkFromMessage,
  } as {
    messages: AgentUIMessage[];
    sendMessage: (
      message: { text: string },
      options?: { body?: AgentChatRequestBodyPatch }
    ) => void;
    stop: () => Promise<void>;
    status: ChatStatus;
    error: Error | undefined;
    pendingElicitation: PendingElicitation | null;
    handleElicitationSubmit: (output: ElicitToolOutput) => void;
    handleElicitationCancel: () => void;
    compactSession: (message?: PendingAgentMessage) => void;
    isCompacting: boolean;
    compactionStatus: string | null;
    operationError: AgentChatOperationError | null;
    clearOperationError: () => void;
    rewindToMessage: (messageId: string) => Promise<string | null>;
    forkFromMessage: (messageId: string) => Promise<void>;
  };
}

// Pydantic will error if given tool calls without inputs, so we filter them out
function removeInterruptedToolInputParts(
  messages: AgentUIMessage[]
): AgentUIMessage[] {
  return messages.map((message) => {
    return {
      ...message,
      parts: message.parts.filter((part) => {
        return (
          !isToolUIPart(part) ||
          (part.state !== "input-streaming" && part.state !== "input-available")
        );
      }),
    };
  });
}

function isRequestActive(status: ChatStatus): boolean {
  return status === "submitted" || status === "streaming";
}

/**
 * Why compaction cannot start right now for a persisted session, or null when
 * it may proceed. Preconditions are checked in priority order.
 */
export function getCompactionBlockedReason({
  isResponseInProgress,
  isCompactionPending,
  isBusyElsewhere,
}: {
  /** This client has a chat request in flight for the session. */
  isResponseInProgress: boolean;
  /** A compaction request is already running for the session. */
  isCompactionPending: boolean;
  /** Another client's turn holds the session's server lock. */
  isBusyElsewhere: boolean;
}): string | null {
  if (isResponseInProgress) {
    return "Wait for the current response to finish and try again.";
  }
  if (isCompactionPending) {
    return "Conversation compaction is already in progress.";
  }
  if (isBusyElsewhere) {
    return "Session is being used elsewhere. Try again when the other turn completes.";
  }
  return null;
}

/**
 * A lock conflict is the one failure the route answers with JSON; every other
 * failure is an `HTTPException` detail, which the server renders as plain text.
 */
function isSessionBusyConflict(body: string): boolean {
  try {
    const parsed: unknown = JSON.parse(body);
    return isRecord(parsed) && parsed.code === SESSION_BUSY_ERROR_CODE;
  } catch {
    return false;
  }
}

function getAgentCompactErrorMessage(body: string, status: number): string {
  return body.trim() || `Compaction failed with status ${status}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getCompactionMessageFromResponse(
  result: unknown
): AgentUIMessage | null {
  if (!isRecord(result) || !isRecord(result.compaction_message)) {
    return null;
  }
  const message = result.compaction_message;
  if (
    typeof message.id !== "string" ||
    message.role !== "user" ||
    !Array.isArray(message.parts) ||
    !isRecord(message.metadata) ||
    message.metadata.type !== "user" ||
    message.metadata.isCompactionMessage !== true
  ) {
    return null;
  }
  return message as unknown as AgentUIMessage;
}
