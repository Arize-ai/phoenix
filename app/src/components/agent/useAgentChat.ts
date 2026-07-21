import { Chat, useChat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import {
  DefaultChatTransport,
  getToolName,
  isTextUIPart,
  isToolUIPart,
} from "ai";
import { useCallback, useEffect, useRef } from "react";
import {
  ConnectionHandler,
  commitLocalUpdate,
  graphql,
  useMutation,
  useRelayEnvironment,
} from "react-relay";

import {
  buildAgentChatRequestBody,
  type AgentChatRequestBodyPatch,
  type AgentModelSelection,
} from "@phoenix/agent/chat/buildAgentChatRequestBody";
import { createClientToolTimingRecorder } from "@phoenix/agent/chat/clientToolTimings";
import { handleAgentToolCall } from "@phoenix/agent/chat/handleAgentToolCall";
import { getUnresolvedToolCalls } from "@phoenix/agent/chat/interruptToolCalls";
import {
  SYSTEM_INTERRUPT_ERROR,
  USER_INTERRUPT_ERROR,
} from "@phoenix/agent/chat/shouldSendAutomatically";
import { createTranscriptPersistenceCoordinator } from "@phoenix/agent/chat/transcriptPersistence";
import { createTurnCompletionGate } from "@phoenix/agent/chat/turnCompletion";
import { createTurnTraceContextManager } from "@phoenix/agent/chat/turnTraceContext";
import {
  getAssistantMessageMetadata,
  type AgentUIMessage,
} from "@phoenix/agent/chat/types";
import { buildUserMessageMetadata } from "@phoenix/agent/chat/userMessageMetadata";
import { selectActiveContexts } from "@phoenix/agent/context/selectors";
import { BATCH_SPAN_ANNOTATE_TOOL_NAME } from "@phoenix/agent/tools/batchSpanAnnotate";
import { EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME } from "@phoenix/agent/tools/codeEvaluatorDraft";
import type {
  ElicitToolOutput,
  PendingElicitation,
} from "@phoenix/agent/tools/elicit";
import { EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { LOAD_DATASET_TOOL_NAME } from "@phoenix/agent/tools/playgroundLoadDataset";
import {
  EDIT_PROMPT_TOOL_NAME,
  REMOVE_PROMPT_INSTANCE_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPrompt";
import { WRITE_PROMPT_TOOLS_TOOL_NAME } from "@phoenix/agent/tools/playgroundPromptTools";
import { SAVE_PROMPT_TOOL_NAME } from "@phoenix/agent/tools/playgroundSavePrompt";
import type { paths } from "@phoenix/api/__generated__/v1";
import { authFetch } from "@phoenix/authFetch";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { useAgentChatRuntime } from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import {
  DRAFT_SESSION_ID,
  type AgentSessionCompaction,
  type PendingAgentMessage,
} from "@phoenix/store/agentStore";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { prependBasename } from "@phoenix/utils/routingUtils";

import type { useAgentChatBranchAgentSessionMutation } from "./__generated__/useAgentChatBranchAgentSessionMutation.graphql";
import type { useAgentChatCreateAgentSessionMutation } from "./__generated__/useAgentChatCreateAgentSessionMutation.graphql";
import type { useAgentChatTruncateAgentSessionMutation } from "./__generated__/useAgentChatTruncateAgentSessionMutation.graphql";
import {
  AGENT_SESSIONS_CONNECTION_KEY,
  refetchAgentSession,
} from "./agentSessionRelay";

type TurnClientState = {
  turnTraceContext: ReturnType<typeof createTurnTraceContextManager>;
  toolTimings: ReturnType<typeof createClientToolTimingRecorder>;
};

const turnClientStateByChat = new WeakMap<
  Chat<AgentUIMessage>,
  TurnClientState
>();

const CHAT_PATH_TEMPLATE =
  "/agents/{agent_id}/sessions/{session_id}/chat" satisfies keyof paths;
const COMPACT_PATH_TEMPLATE =
  "/agents/{agent_id}/sessions/{session_id}/compact" satisfies keyof paths;
const ASSISTANT_AGENT_ID = "assistant";

function buildAgentChatApiUrl(sessionId: string): string {
  return prependBasename(
    CHAT_PATH_TEMPLATE.replace("{agent_id}", ASSISTANT_AGENT_ID).replace(
      "{session_id}",
      encodeURIComponent(sessionId)
    )
  );
}

function buildAgentCompactApiUrl(sessionId: string): string {
  return prependBasename(
    COMPACT_PATH_TEMPLATE.replace("{agent_id}", ASSISTANT_AGENT_ID).replace(
      "{session_id}",
      encodeURIComponent(sessionId)
    )
  );
}

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
        isTemporary
        createdAt
        updatedAt
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
        updatedAt
        messages
        compactionMessageId
        compactionSummary
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
        isTemporary
        createdAt
        updatedAt
        messages
      }
    }
  }
`;

/**
 * Subscribes the current render surface to the persistent AI SDK chat runtime
 * for a single agent session/model pair.
 *
 * `useChat` alone is tied to the current mounted component, which is too short-
 * lived for this agent UX: the visible chat surface can move between the docked
 * panel and the trace slideover, and model changes intentionally replace the
 * underlying transport. This hook keeps the imperative AI SDK `Chat` instance
 * in the app-level runtime registry, then binds the current React surface to
 * whichever runtime instance should own the session right now.
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
  modelSelection,
  initialMessages,
  initialCompaction,
}: {
  /**
   * The session's Relay node ID, or {@link DRAFT_SESSION_ID} (or null) for a
   * not-yet-persisted new-chat draft.
   */
  sessionId: string | null;
  modelSelection: AgentModelSelection;
  /** Server transcript used to seed the runtime chat on its first bind. */
  initialMessages?: AgentUIMessage[];
  /** Server compaction event used to seed ephemeral session state. */
  initialCompaction?: AgentSessionCompaction | null;
}) {
  const store = useAgentStore();
  const runtime = useAgentChatRuntime();
  const relayEnvironment = useRelayEnvironment();
  const notifyError = useNotifyError();
  const notifySuccess = useNotifySuccess();
  const isDraft = sessionId == null || sessionId === DRAFT_SESSION_ID;
  const isCompacting = useAgentContext((state) =>
    sessionId
      ? (state.isCompactionPendingBySessionId[sessionId] ?? false)
      : false
  );
  const compaction = useAgentContext((state) =>
    sessionId ? state.compactionBySessionId[sessionId] : undefined
  );
  const pendingElicitation = useAgentContext((state) =>
    sessionId ? (state.pendingElicitationBySessionId[sessionId] ?? null) : null
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
  // Guards the draft surface against double-submits while the create-session
  // mutation is in flight.
  const isCreatingSessionRef = useRef(false);

  useEffect(() => {
    if (sessionId && initialCompaction !== undefined) {
      store.getState().setSessionCompaction(sessionId, initialCompaction);
    }
  }, [initialCompaction, sessionId, store]);

  // The Chat is cached per-session in the runtime registry, so its transport
  // and onFinish closures are captured once and reused across model changes.
  // Read through the ref so the latest model selection takes effect on the
  // next send without rebuilding the Chat.
  const modelSelectionRef = useRef(modelSelection);
  modelSelectionRef.current = modelSelection;

  /**
   * Builds the imperative AI SDK chat runtime for a persisted session. The
   * closures capture the session's canonical Relay ID, so a draft surface only
   * builds a chat after the create-session mutation returns one.
   */
  const createChatForSession = useCallback(
    (
      targetSessionId: string,
      seedMessages: AgentUIMessage[]
    ): Chat<AgentUIMessage> => {
      const chatApiUrl = buildAgentChatApiUrl(targetSessionId);
      const turnTraceContext = createTurnTraceContextManager();
      const toolTimings = createClientToolTimingRecorder();
      const transcriptPersistence = createTranscriptPersistenceCoordinator();
      const turnCompletionGate = createTurnCompletionGate({
        endTurn: async () => {
          store.getState().setSessionResponsePending(targetSessionId, false);
          turnTraceContext.clear();
          toolTimings.clear();
        },
        finalize: () => {
          // The server persisted the turn's transcript (and possibly a
          // summarized title); refetch the canonical session record so Relay
          // reflects it.
          void refetchAgentSession({
            environment: relayEnvironment,
            sessionId: targetSessionId,
          });
        },
      });
      const chat = new Chat<AgentUIMessage>({
        id: targetSessionId,
        messages: seedMessages,
        generateId: () => crypto.randomUUID(),
        transport: new DefaultChatTransport({
          api: chatApiUrl,
          fetch: authFetch,
          prepareSendMessagesRequest: ({ body, id, messages }) => {
            // The gate may clear state for a stale completed turn before
            // this request reads the active turn trace context.
            turnCompletionGate.beginTurn();
            store.getState().setSessionResponsePending(targetSessionId, true);
            return {
              body: buildAgentChatRequestBody({
                body,
                id,
                messages,
                capabilities: store.getState().capabilities,
                observability: store.getState().observability,
                agentsConfig: store.getState().agentsConfig,
                permissions: store.getState().permissions,
                contexts: selectActiveContexts(store.getState()),
                modelSelection: modelSelectionRef.current,
                turnTraceContext: turnTraceContext.getActive(),
                toolTimings,
              }),
            };
          },
        }),
        // Tool execution must target the runtime-owned chat instance so
        // tool outputs continue to attach to the correct conversation
        // even if the visible React surface remounts during the request.
        onToolCall: ({ toolCall }) => {
          const providerMetadata =
            "providerMetadata" in toolCall ? toolCall.providerMetadata : null;
          const phoenixMetadata = isRecord(providerMetadata)
            ? providerMetadata.phoenix
            : null;
          const isServerExecuted =
            isRecord(phoenixMetadata) &&
            phoenixMetadata.toolExecutionEnvironment === "server";
          if (!isServerExecuted) {
            toolTimings.recordStart(toolCall.toolCallId);
          }
          void handleAgentToolCall({
            toolCall,
            sessionId: targetSessionId,
            addToolOutput: async (toolOutput) => {
              toolTimings.recordEnd(toolCall.toolCallId);
              await chat.addToolOutput(toolOutput);
            },
            appendMessagePart: (part) => {
              chat.messages = appendPartToToolMessage({
                messages: chat.messages,
                toolCallId: toolCall.toolCallId,
                part,
              });
            },
            agentStore: store,
          });
        },
        onData: (dataPart) => {
          if (dataPart.type === "data-session-summary") {
            // The stream's summarized title is already persisted server-side;
            // mirror it onto the Relay record so the session list updates live.
            commitLocalUpdate(relayEnvironment, (relayStore) => {
              relayStore.get(targetSessionId)?.setValue(dataPart.data, "title");
            });
          } else if (dataPart.type === "data-transcript-persisted") {
            transcriptPersistence.acknowledge(dataPart.data);
          }
        },
        sendAutomaticallyWhen: async ({ messages }) => {
          const shouldSendAutomatically =
            await turnCompletionGate.handleSendAutomaticallyWhen({ messages });
          if (!shouldSendAutomatically) {
            return false;
          }
          const assistantMessage = messages.at(-1);
          if (assistantMessage?.role !== "assistant") {
            return false;
          }
          return transcriptPersistence.waitForMessage({
            messageId: assistantMessage.id,
          });
        },
        onError: (error) => {
          transcriptPersistence.cancelPendingWaiters();
          turnCompletionGate.fail(error);
        },
        onFinish: ({ messages: finalMessages, message }) => {
          turnTraceContext.captureFromMetadata(
            getAssistantMessageMetadata(message)?.turnTraceContext
          );
          turnCompletionGate.handleFinish({ finalMessages, message });
        },
      });
      turnClientStateByChat.set(chat, { turnTraceContext, toolTimings });
      return chat;
    },
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
      if (toolCall.tool === EDIT_PROMPT_TOOL_NAME) {
        store.getState().setPendingPromptEdit(toolCall.toolCallId, null);
      }
      if (toolCall.tool === REMOVE_PROMPT_INSTANCE_TOOL_NAME) {
        store
          .getState()
          .setPendingPromptInstanceRemoval(toolCall.toolCallId, null);
      }
      if (toolCall.tool === BATCH_SPAN_ANNOTATE_TOOL_NAME) {
        store.getState().setPendingBatchSpanAnnotate(toolCall.toolCallId, null);
      }
      if (toolCall.tool === WRITE_PROMPT_TOOLS_TOOL_NAME) {
        store.getState().setPendingPromptToolWrite(toolCall.toolCallId, null);
      }
      if (toolCall.tool === SAVE_PROMPT_TOOL_NAME) {
        store.getState().setPendingSavePrompt(toolCall.toolCallId, null);
      }
      if (toolCall.tool === EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME) {
        store.getState().setPendingCodeEvaluatorEdit(toolCall.toolCallId, null);
      }
      if (toolCall.tool === EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME) {
        store.getState().setPendingLlmEvaluatorEdit(toolCall.toolCallId, null);
      }
      if (toolCall.tool === LOAD_DATASET_TOOL_NAME) {
        store.getState().setPendingLoadDataset(toolCall.toolCallId, null);
      }
    });

    const turnClientState = chatInstance
      ? turnClientStateByChat.get(chatInstance)
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
      const turnClientState = turnClientStateByChat.get(chatInstance);
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
    isCreatingSessionRef.current = true;
    commitCreateAgentSession({
      variables: {
        input: { temporary: store.getState().isDraftSessionTemporary },
        connections: [sessionsConnectionId],
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
        const state = store.getState();
        state.clearSessionEphemeralState(DRAFT_SESSION_ID);
        state.setIsDraftSessionTemporary(state.defaultTemporaryChat);
        state.setActiveSession(newSessionId);
      },
      onError: (mutationError) => {
        isCreatingSessionRef.current = false;
        // Give the user their message back to retry.
        store.getState().setDraftInput(DRAFT_SESSION_ID, text);
        const errorMessages =
          getErrorMessagesFromRelayMutationError(mutationError);
        notifyError({
          title: "Conversation could not be started",
          message: errorMessages?.[0] ?? mutationError.message,
        });
      },
    });
  };

  const handleSendMessage = async (...args: Parameters<typeof sendMessage>) => {
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
    const restorePendingMessage = () => {
      if (pendingMessage && sessionId) {
        store.getState().setDraftInput(sessionId, pendingMessage.text);
      }
    };
    if (isDraft || !sessionId || !chatInstance) {
      restorePendingMessage();
      notifyError({
        title: "Conversation could not be compacted",
        message: "There is no persisted conversation to compact.",
      });
      return;
    }
    if (isRequestActive(chatInstance.status)) {
      restorePendingMessage();
      notifyError({
        title: "Conversation could not be compacted",
        message: "Wait for the current response to finish and try again.",
      });
      return;
    }
    if (store.getState().isCompactionPendingBySessionId[sessionId]) {
      restorePendingMessage();
      notifyError({
        title: "Conversation could not be compacted",
        message: "Conversation compaction is already in progress.",
      });
      return;
    }

    store.getState().setSessionCompactionPending(sessionId, true);
    void (async () => {
      try {
        const response = await authFetch(buildAgentCompactApiUrl(sessionId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: modelSelectionRef.current }),
        });
        if (!response.ok) {
          throw new Error(await getAgentCompactErrorMessage(response));
        }
        const result: unknown = await response.json();
        const wasCompacted =
          isRecord(result) && typeof result.compacted === "boolean"
            ? result.compacted
            : false;
        const compactionMessageId =
          isRecord(result) && typeof result.compactionMessageId === "string"
            ? result.compactionMessageId
            : null;
        const compactionSummary =
          isRecord(result) && typeof result.compactionSummary === "string"
            ? result.compactionSummary
            : null;
        store
          .getState()
          .setSessionCompaction(
            sessionId,
            compactionMessageId && compactionSummary
              ? { messageId: compactionMessageId, summary: compactionSummary }
              : null
          );
        commitLocalUpdate(relayEnvironment, (relayStore) => {
          const sessionRecord = relayStore.get(sessionId);
          sessionRecord?.setValue(compactionMessageId, "compactionMessageId");
          sessionRecord?.setValue(compactionSummary, "compactionSummary");
        });
        notifySuccess({
          title: wasCompacted
            ? "Conversation compacted"
            : "Conversation already compact",
          message: wasCompacted
            ? "Older turns will be represented by a durable checkpoint."
            : "There are no older complete turns to compact.",
        });
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
        restorePendingMessage();
        notifyError({
          title: "Conversation could not be compacted",
          message:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred.",
        });
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
      turnClientStateByChat
        .get(chatInstance)
        ?.toolTimings.recordEnd(pendingElicitation.toolCallId);
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
      turnClientStateByChat
        .get(chatInstance)
        ?.toolTimings.recordEnd(pendingElicitation.toolCallId);
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
          if (toolName === EDIT_PROMPT_TOOL_NAME) {
            state.setPendingPromptEdit(part.toolCallId, null);
          } else if (toolName === REMOVE_PROMPT_INSTANCE_TOOL_NAME) {
            state.setPendingPromptInstanceRemoval(part.toolCallId, null);
          } else if (toolName === BATCH_SPAN_ANNOTATE_TOOL_NAME) {
            state.setPendingBatchSpanAnnotate(part.toolCallId, null);
          } else if (toolName === WRITE_PROMPT_TOOLS_TOOL_NAME) {
            state.setPendingPromptToolWrite(part.toolCallId, null);
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
  // or null (assistant target / no-op / failure).
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
      return new Promise((resolve) => {
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
            const compactionMessageId =
              payload.agentSession.compactionMessageId;
            const compactionSummary = payload.agentSession.compactionSummary;
            store.getState().setSessionCompaction(
              sessionId,
              compactionMessageId && compactionSummary
                ? {
                    messageId: compactionMessageId,
                    summary: compactionSummary,
                  }
                : null
            );
            clearError();
            resolve(restoredInput);
          },
          onError: (mutationError) => {
            const errorMessages =
              getErrorMessagesFromRelayMutationError(mutationError);
            notifyError({
              title: "Conversation could not be rewound",
              message: errorMessages?.[0] ?? mutationError.message,
            });
            resolve(null);
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
      notifyError,
      sessionId,
      setMessages,
      store,
    ]
  );

  // Branches the active session into a new server session truncated at the
  // chosen message, leaving the current session untouched. The server copies
  // the truncated transcript and derives the branch title; the UI seeds a
  // runtime chat from the returned transcript and activates it.
  const forkFromMessage = useCallback(
    (messageId: string): void => {
      if (isDraft || !sessionId || !chatInstance) {
        return;
      }
      clearError();
      // Branching at a user message drops it from the branch; remember its
      // text now so the branch's composer starts with it.
      const restoredInput = getRemovedUserMessageText(
        chatInstance.messages,
        messageId
      );
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
        },
        onError: (mutationError) => {
          const errorMessages =
            getErrorMessagesFromRelayMutationError(mutationError);
          notifyError({
            title: "Conversation could not be branched",
            message: errorMessages?.[0] ?? mutationError.message,
          });
        },
      });
    },
    [
      chatInstance,
      clearError,
      commitBranchAgentSession,
      createChatForSession,
      isDraft,
      notifyError,
      runtime,
      sessionId,
      sessionsConnectionId,
      store,
    ]
  );

  return {
    messages,
    sendMessage: handleSendMessage,
    stop: handleStopWithToolCleanup,
    status,
    error,
    pendingElicitation,
    handleElicitationSubmit,
    handleElicitationCancel,
    compactSession,
    isCompacting,
    compaction,
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
    compaction: AgentSessionCompaction | undefined;
    rewindToMessage: (messageId: string) => Promise<string | null>;
    forkFromMessage: (messageId: string) => void;
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
 * The text of the user message a rewind/branch at `messageId` removes, or null
 * when the target is not a user message (assistant targets are retained).
 */
function getRemovedUserMessageText(
  messages: AgentUIMessage[],
  messageId: string
): string | null {
  const target = messages.find((message) => message.id === messageId);
  if (!target || target.role !== "user") {
    return null;
  }
  return target.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

function isRequestActive(status: ChatStatus): boolean {
  return status === "submitted" || status === "streaming";
}

async function getAgentCompactErrorMessage(
  response: Response
): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    // Fall back to the HTTP status when the response is not JSON.
  }
  return `Compaction failed with status ${response.status}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function appendPartToToolMessage({
  messages,
  toolCallId,
  part,
}: {
  messages: AgentUIMessage[];
  toolCallId: string;
  part: AgentUIMessage["parts"][number];
}): AgentUIMessage[] {
  const messageIndex = messages.findIndex((message) =>
    message.parts.some(
      (messagePart) =>
        isToolUIPart(messagePart) && messagePart.toolCallId === toolCallId
    )
  );
  if (messageIndex === -1) {
    return messages;
  }
  return messages.map((message, index) => {
    if (index !== messageIndex) {
      return message;
    }
    return {
      ...message,
      parts: [...message.parts, part],
    };
  });
}
