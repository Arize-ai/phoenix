import { type Chat, useChat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import { isToolUIPart } from "ai";
import { useCallback, useMemo, useRef, useState } from "react";
import { useRelayEnvironment } from "react-relay";

import {
  SESSION_BUSY_ERROR_CODE,
  buildAgentChatApiUrl,
  buildAgentCompactApiUrl,
} from "@phoenix/agent/chat/agentChatApi";
import type { AgentChatRequestBodyPatch } from "@phoenix/agent/chat/buildAgentChatRequestBody";
import { isRequestActive } from "@phoenix/agent/chat/chatUtils";
import {
  createAgentSessionChat,
  getTurnClientState,
} from "@phoenix/agent/chat/createAgentSessionChat";
import { getUnresolvedToolCalls } from "@phoenix/agent/chat/interruptToolCalls";
import { cleanupPendingToolState } from "@phoenix/agent/chat/pendingToolStateCleanup";
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
import {
  DRAFT_SESSION_ID,
  type PendingAgentMessage,
} from "@phoenix/store/agentStore";
import { isRecord } from "@phoenix/utils/typeUtils";

import { refetchAgentSession } from "./agentSessionRelay";
import type { AgentChatOperationError } from "./types";
import { selectAgentModel } from "./useAgentChatPanelState";
import { useAgentSessionHistory } from "./useAgentSessionHistory";
import {
  useAgentSessionSync,
  type LastSyncedSessionState,
} from "./useAgentSessionSync";
import { useDraftSessionCreation } from "./useDraftSessionCreation";

export type { AgentChatOperationError } from "./types";

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
 * session exists yet; the first send runs the `createAgentSession` mutation
 * ({@link useDraftSessionCreation}), seeds a runtime chat under the returned
 * Relay ID, and activates it. Relay is the durable source of truth for
 * session identity, titles, and transcripts — each completed turn refetches
 * the session node so the store stays canonical, and
 * {@link useAgentSessionSync} keeps idle sessions synchronized with turns
 * completed by other clients.
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
  /**
   * Shared between the session-sync poll (which reads and writes it) and the
   * chat factory's turn-completion refetch (which records this client's own
   * turns); see {@link useAgentSessionSync}.
   */
  const lastSyncedSessionStateRef = useRef<LastSyncedSessionState | null>(null);
  const [compactionStatus, setCompactionStatus] = useState<string | null>(null);
  const isDraft = sessionId == null || sessionId === DRAFT_SESSION_ID;
  const isCompacting = useAgentContext((state) =>
    sessionId
      ? (state.isCompactionPendingBySessionId[sessionId] ?? false)
      : false
  );
  const pendingElicitation = useAgentContext((state) =>
    sessionId ? (state.pendingElicitationBySessionId[sessionId] ?? null) : null
  );
  const isBusyElsewhere = useAgentContext((state) =>
    sessionId ? (state.isBusyElsewhereBySessionId[sessionId] ?? false) : false
  );

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

  useAgentSessionSync({
    persistedSessionId,
    chatInstance,
    chatStatus: status,
    isActive,
    isCompacting,
    isBusyElsewhere,
    shouldSyncOnMount,
    lastSyncedSessionStateRef,
  });

  const { pendingDraftUserMessage, createSessionAndSendMessage } =
    useDraftSessionCreation({
      createChatForSession,
      setOperationError,
    });

  const { rewindToMessage, forkFromMessage } = useAgentSessionHistory({
    sessionId,
    isDraft,
    chatInstance,
    pendingElicitation,
    createChatForSession,
    setMessages,
    clearError,
  });

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
      cleanupPendingToolState(
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
