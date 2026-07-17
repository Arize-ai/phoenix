import { Chat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import { DefaultChatTransport, isToolUIPart } from "ai";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useSyncExternalStore,
} from "react";
import { graphql, useMutation, useRelayEnvironment } from "react-relay";

import { buildAgentModelSelectionFromConfig } from "@phoenix/agent/chat/agentModelSelection";
import {
  buildAgentChatRequestBody,
  type AgentChatRequestBodyPatch,
  type AgentModelSelection,
} from "@phoenix/agent/chat/buildAgentChatRequestBody";
import {
  createClientToolTimingRecorder,
  type ClientToolTimingRecorder,
} from "@phoenix/agent/chat/clientToolTimings";
import { handleAgentToolCall } from "@phoenix/agent/chat/handleAgentToolCall";
import { getUnresolvedToolCalls } from "@phoenix/agent/chat/interruptToolCalls";
import { rewindMessages } from "@phoenix/agent/chat/rewindMessages";
import {
  SYSTEM_INTERRUPT_ERROR,
  USER_INTERRUPT_ERROR,
} from "@phoenix/agent/chat/shouldSendAutomatically";
import { createTurnCompletionGate } from "@phoenix/agent/chat/turnCompletion";
import {
  createTurnTraceContextManager,
  type TurnTraceContextManager,
} from "@phoenix/agent/chat/turnTraceContext";
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
import { authFetch } from "@phoenix/authFetch";
import { useNotifyError } from "@phoenix/contexts";
import {
  type AgentChatRuntime,
  useAgentChatRuntimeVersion,
} from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { useAgentChatForkMutation } from "./__generated__/useAgentChatForkMutation.graphql";
import type { useAgentChatTruncateMutation } from "./__generated__/useAgentChatTruncateMutation.graphql";
import { refetchAgentSessions, refreshAgentSession } from "./agentSessionRelay";

type TurnClientState = {
  turnTraceContext: TurnTraceContextManager;
  toolTimings: ClientToolTimingRecorder;
};

const turnClientStateByChat = new WeakMap<
  Chat<AgentUIMessage>,
  TurnClientState
>();

const EMPTY_AGENT_MESSAGES: AgentUIMessage[] = [];
const EMPTY_SUBSCRIPTION = () => undefined;

export async function syncCommittedAgentSession({
  runtime,
  sessionId,
  chat,
  refreshSession,
}: {
  runtime: Pick<
    AgentChatRuntime,
    "evictChat" | "getChat" | "setSyncError" | "subscribe"
  >;
  sessionId: string;
  chat: Chat<AgentUIMessage>;
  refreshSession: () => Promise<unknown>;
}): Promise<boolean> {
  runtime.setSyncError(sessionId, null);
  try {
    await refreshSession();
    if (runtime.evictChat({ sessionId, expectedChat: chat })) {
      return true;
    }
    if (
      runtime.getChat(sessionId) !== chat ||
      getUnresolvedToolCalls(chat.messages).length > 0
    ) {
      return false;
    }
    return await new Promise<boolean>((resolve) => {
      let isSettled = false;
      let unsubscribe: () => void = () => undefined;
      const settle = (wasEvicted: boolean) => {
        if (isSettled) {
          return;
        }
        isSettled = true;
        unsubscribe();
        resolve(wasEvicted);
      };
      const evictSettledChat = () => {
        if (runtime.getChat(sessionId) !== chat) {
          settle(false);
          return;
        }
        if (chat.status === "submitted" || chat.status === "streaming") {
          return;
        }
        isSettled = true;
        unsubscribe();
        resolve(runtime.evictChat({ sessionId, expectedChat: chat }));
      };
      unsubscribe = runtime.subscribe(evictSettledChat);
      evictSettledChat();
    });
  } catch (error) {
    runtime.setSyncError(
      sessionId,
      error instanceof Error
        ? error
        : new Error("The saved transcript could not be refreshed.")
    );
    return false;
  }
}

export function applyCanonicalRewind({
  chat,
  previousMessages,
  responseMessages,
  clearDroppedToolState,
}: {
  chat: Chat<AgentUIMessage> | null;
  previousMessages: AgentUIMessage[];
  responseMessages: unknown;
  clearDroppedToolState: (messages: {
    previous: AgentUIMessage[];
    next: AgentUIMessage[];
  }) => void;
}): AgentUIMessage[] {
  const canonicalMessages = getAgentMessages(responseMessages);
  clearDroppedToolState({
    previous: previousMessages,
    next: canonicalMessages,
  });
  if (chat) {
    chat.messages = canonicalMessages;
    chat.clearError();
  }
  return canonicalMessages;
}

function useRuntimeChatState(chat: Chat<AgentUIMessage> | null) {
  const subscribeToMessages = useCallback(
    (listener: () => void) =>
      chat?.["~registerMessagesCallback"](listener) ?? EMPTY_SUBSCRIPTION,
    [chat]
  );
  const subscribeToStatus = useCallback(
    (listener: () => void) =>
      chat?.["~registerStatusCallback"](listener) ?? EMPTY_SUBSCRIPTION,
    [chat]
  );
  const subscribeToError = useCallback(
    (listener: () => void) =>
      chat?.["~registerErrorCallback"](listener) ?? EMPTY_SUBSCRIPTION,
    [chat]
  );
  const getMessages = useCallback(
    () => chat?.messages ?? EMPTY_AGENT_MESSAGES,
    [chat]
  );
  const getStatus = useCallback(() => chat?.status ?? "ready", [chat]);
  const getError = useCallback(() => chat?.error, [chat]);

  return {
    messages: useSyncExternalStore(
      subscribeToMessages,
      getMessages,
      getMessages
    ),
    status: useSyncExternalStore(subscribeToStatus, getStatus, getStatus),
    error: useSyncExternalStore(subscribeToError, getError, getError),
  };
}

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
 * App-local metadata still lives in the agent store:
 * - pending elicitation is store-backed and survives remounts
 * - titles arrive in-band from the chat stream and are store-backed
 */
export function useAgentChat({
  sessionId,
  chatApiUrl,
  modelSelection,
  initialMessages,
}: {
  sessionId: string | null;
  chatApiUrl: string;
  modelSelection: AgentModelSelection;
  initialMessages?: AgentUIMessage[];
}) {
  const store = useAgentStore();
  const runtime = useAgentChatRuntimeVersion();
  const relayEnvironment = useRelayEnvironment();
  const notifyError = useNotifyError();
  const sessionOperation = useAgentContext((state) =>
    sessionId ? state.sessionOperationById[sessionId] : undefined
  );
  const isSessionOperationPending =
    sessionOperation === "rewinding" || sessionOperation === "forking";
  const [commitTruncate] = useMutation<useAgentChatTruncateMutation>(graphql`
    mutation useAgentChatTruncateMutation($id: ID!, $lastMessageId: String) {
      truncateAgentSession(input: { id: $id, lastMessageId: $lastMessageId }) {
        agentSession {
          id
          messages
          updatedAt
        }
      }
    }
  `);
  const [commitFork] = useMutation<useAgentChatForkMutation>(graphql`
    mutation useAgentChatForkMutation(
      $sourceSessionId: ID!
      $lastMessageId: String
    ) {
      forkAgentSession(
        input: {
          sourceSessionId: $sourceSessionId
          lastMessageId: $lastMessageId
        }
      ) {
        agentSession {
          id
          title
          createdAt
          messages
        }
      }
    }
  `);
  const pendingElicitation = useAgentContext((state) =>
    sessionId ? (state.pendingElicitationBySessionId[sessionId] ?? null) : null
  );

  const chatInstance = sessionId ? runtime.getChat(sessionId) : null;
  const runtimeChatState = useRuntimeChatState(chatInstance);
  const messages = chatInstance
    ? runtimeChatState.messages
    : (initialMessages ?? EMPTY_AGENT_MESSAGES);
  const status = chatInstance ? runtimeChatState.status : "ready";
  const error = chatInstance ? runtimeChatState.error : undefined;
  const syncError = sessionId ? runtime.getSyncError(sessionId) : null;

  const getOrCreateRuntimeChat = () => {
    if (!sessionId) {
      return null;
    }
    return runtime.getOrCreateChat({
      sessionId,
      chatApiUrl,
      createChat: () => {
        const runtimeMessages =
          runtime.getChat(sessionId)?.messages ??
          initialMessages ??
          EMPTY_AGENT_MESSAGES;
        const turnTraceContext = createTurnTraceContextManager();
        const toolTimings = createClientToolTimingRecorder();
        const turnCompletionGate = createTurnCompletionGate({
          endTurn: async () => {
            turnTraceContext.clear();
            toolTimings.clear();
          },
          finalize: ({ message }) => {
            const usage = getAssistantMessageMetadata(message)?.usage;
            if (usage != null) {
              store.getState().setSessionUsage(sessionId, {
                ...usage.tokens,
                ...(usage.promptDetails
                  ? { promptDetails: usage.promptDetails }
                  : {}),
              });
            }
          },
        });
        const chat = new Chat<AgentUIMessage>({
          id: sessionId,
          messages: runtimeMessages,
          transport: new DefaultChatTransport({
            api: chatApiUrl,
            fetch: authFetch,
            prepareSendMessagesRequest: ({
              body,
              id,
              messages,
              trigger,
              messageId,
            }) => {
              // The gate may clear state for a stale completed turn before
              // this request reads the active turn trace context.
              turnCompletionGate.beginTurn();
              return {
                body: buildAgentChatRequestBody({
                  body,
                  id,
                  agentSessionId: sessionId,
                  messages,
                  trigger,
                  messageId,
                  capabilities: store.getState().capabilities,
                  observability: store.getState().observability,
                  agentsConfig: store.getState().agentsConfig,
                  permissions: store.getState().permissions,
                  contexts: selectActiveContexts(store.getState()),
                  modelSelection: (() => {
                    const currentModelConfig =
                      store.getState().sessionStateById[sessionId]?.modelConfig;
                    return currentModelConfig
                      ? buildAgentModelSelectionFromConfig(currentModelConfig)
                      : modelSelection;
                  })(),
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
              sessionId,
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
            if (dataPart.type === "data-session-committed") {
              void syncCommittedAgentSession({
                runtime,
                sessionId,
                chat,
                refreshSession: () =>
                  refreshAgentSession({
                    environment: relayEnvironment,
                    sessionId: dataPart.data.id,
                  }),
              });
              return;
            }
            if (dataPart.type === "data-session-summary") {
              void refetchAgentSessions({ environment: relayEnvironment });
            }
          },
          sendAutomaticallyWhen: ({ messages }) =>
            turnCompletionGate.handleSendAutomaticallyWhen({ messages }),
          onError: (error) => {
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
    });
  };

  // Anthropic doesn't accept unresolved tool calls, so we resolve them by
  // marking them as error before the next request goes out.
  const addInterruptedToolOutputs = async ({
    chat,
    messages,
    errorText,
  }: {
    chat: Chat<AgentUIMessage>;
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

    const turnClientState = turnClientStateByChat.get(chat);
    await Promise.all(
      unresolvedToolCalls.map((toolCall) => {
        const toolOutput = {
          tool: toolCall.tool,
          toolCallId: toolCall.toolCallId,
          errorText,
          state: "output-error",
        } as const;
        turnClientState?.toolTimings.recordEnd(toolCall.toolCallId);
        return chat.addToolOutput(toolOutput);
      })
    );
  };

  const handleStopWithToolCleanup = async () => {
    const activeChat = sessionId ? runtime.getChat(sessionId) : null;
    if (!activeChat) {
      return;
    }
    await activeChat.stop();
    const latestMessages = activeChat.messages;
    await addInterruptedToolOutputs({
      chat: activeChat,
      messages: latestMessages,
      errorText: USER_INTERRUPT_ERROR,
    });
    const turnClientState = turnClientStateByChat.get(activeChat);
    turnClientState?.turnTraceContext.clear();
    turnClientState?.toolTimings.clear();
    activeChat.messages = removeInterruptedToolInputParts(activeChat.messages);
  };

  const handleSendMessage = async (
    message: { text: string },
    options?: { body?: AgentChatRequestBodyPatch }
  ) => {
    if (
      !sessionId ||
      store.getState().sessionOperationById[sessionId] !== undefined
    ) {
      return;
    }

    const activeChat = getOrCreateRuntimeChat();
    if (!activeChat || isRequestActive(activeChat.status)) {
      return;
    }
    const latestMessages = activeChat.messages;
    if (getUnresolvedToolCalls(latestMessages).length > 0) {
      await addInterruptedToolOutputs({
        chat: activeChat,
        messages: latestMessages,
        errorText: SYSTEM_INTERRUPT_ERROR,
      });
    }
    activeChat.messages = removeInterruptedToolInputParts(activeChat.messages);

    await activeChat.sendMessage(
      { ...message, metadata: buildUserMessageMetadata() },
      options
    );
  };
  const sendPendingMessage = useEffectEvent(
    (pending: { text: string; requestedSkills: string[] }) => {
      void handleSendMessage(
        { text: pending.text },
        pending.requestedSkills.length > 0
          ? { body: { requestedSkills: pending.requestedSkills } }
          : undefined
      );
    }
  );

  // Pending sends are owned by the runtime rather than the visible chat view.
  // This lets a newly-created session begin streaming even if the user switched
  // sessions while its create mutation was in flight.
  useEffect(() => {
    if (!sessionId) {
      return;
    }
    const pending = store.getState().consumePendingMessage(sessionId);
    if (!pending) {
      return;
    }
    sendPendingMessage(pending);
  }, [sessionId, store]);

  // Elicitation responses are written back through the runtime-owned chat so
  // the pending tool call resolves against the correct assistant turn.
  const handleElicitationSubmit = (output: ElicitToolOutput) => {
    if (!pendingElicitation || !sessionId) {
      return;
    }
    const activeChat = runtime.getChat(sessionId);
    if (!activeChat) {
      return;
    }
    turnClientStateByChat
      .get(activeChat)
      ?.toolTimings.recordEnd(pendingElicitation.toolCallId);
    void activeChat.addToolOutput({
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
    const activeChat = runtime.getChat(sessionId);
    if (!activeChat) {
      return;
    }
    turnClientStateByChat
      .get(activeChat)
      ?.toolTimings.recordEnd(pendingElicitation.toolCallId);
    void activeChat.addToolOutput({
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
      const droppedToolCallIds: string[] = [];
      for (const message of previous) {
        for (const part of message.parts) {
          if (!isToolUIPart(part) || retained.has(part.toolCallId)) {
            continue;
          }
          droppedToolCallIds.push(part.toolCallId);
        }
      }
      state.clearPendingToolState({ toolCallIds: droppedToolCallIds });
    },
    [sessionId, store]
  );

  // Rewinds the active session in place to the chosen message, truncating the
  // transcript and releasing stale tool state. Returns the user message text to
  // restore into the input (user target) or null (assistant target / no-op).
  const rewindToMessage = useCallback(
    async (messageId: string): Promise<string | null> => {
      const activeChat = sessionId ? runtime.getChat(sessionId) : null;
      if (
        !sessionId ||
        store.getState().sessionOperationById[sessionId] !== undefined ||
        (activeChat && isRequestActive(activeChat.status))
      ) {
        return null;
      }
      const previousMessages = activeChat?.messages ?? messages;
      const result = rewindMessages({
        messages: previousMessages,
        messageId,
      });
      if (!result) {
        return null;
      }
      store.getState().setSessionOperation(sessionId, "rewinding");
      try {
        const response = await new Promise<
          useAgentChatTruncateMutation["response"]
        >((resolve, reject) => {
          commitTruncate({
            variables: {
              id: sessionId,
              lastMessageId: result.messages.at(-1)?.id ?? null,
            },
            onCompleted: resolve,
            onError: reject,
          });
        });
        applyCanonicalRewind({
          chat: activeChat,
          previousMessages,
          responseMessages: response.truncateAgentSession.agentSession.messages,
          clearDroppedToolState,
        });
        return result.restoredInput;
      } catch (error) {
        const mutationError =
          error instanceof Error ? error : new Error("Unknown mutation error");
        const messages = getErrorMessagesFromRelayMutationError(mutationError);
        notifyError({
          title: "Session could not be rewound",
          message: messages?.[0] ?? mutationError.message,
        });
        return null;
      } finally {
        store.getState().setSessionOperation(sessionId, null);
      }
    },
    [
      clearDroppedToolState,
      commitTruncate,
      messages,
      notifyError,
      runtime,
      sessionId,
      store,
    ]
  );

  // Branches the active session into a new session truncated to the chosen
  // message, leaving the current session untouched. Returns the new session id.
  const forkFromMessage = useCallback(
    async (messageId: string): Promise<string | null> => {
      const activeChat = sessionId ? runtime.getChat(sessionId) : null;
      if (
        !sessionId ||
        store.getState().sessionOperationById[sessionId] !== undefined ||
        (activeChat && isRequestActive(activeChat.status))
      ) {
        return null;
      }
      const result = rewindMessages({
        messages: activeChat?.messages ?? messages,
        messageId,
      });
      if (!result) {
        return null;
      }
      activeChat?.clearError();
      const sourceSession = store.getState().sessionStateById[sessionId];
      store.getState().setSessionOperation(sessionId, "forking");
      try {
        const response = await new Promise<
          useAgentChatForkMutation["response"]
        >((resolve, reject) => {
          commitFork({
            variables: {
              sourceSessionId: sessionId,
              lastMessageId: result.messages.at(-1)?.id ?? null,
            },
            onCompleted: resolve,
            onError: reject,
          });
        });
        const forkedSession = response.forkAgentSession.agentSession;
        store.getState().cacheSession(forkedSession.id);
        if (sourceSession) {
          store
            .getState()
            .updateSessionModelConfig(
              forkedSession.id,
              sourceSession.modelConfig
            );
          sourceSession.context.forEach((context) =>
            store.getState().addSessionContext(forkedSession.id, context)
          );
        }
        if (result.restoredInput) {
          store
            .getState()
            .setDraftInput(forkedSession.id, result.restoredInput);
        }
        store.getState().setActiveSession(forkedSession.id);
        void refetchAgentSessions({ environment: relayEnvironment }).catch(
          (error) => {
            const refreshError =
              error instanceof Error
                ? error
                : new Error("Unknown session-list refresh error");
            const messages =
              getErrorMessagesFromRelayMutationError(refreshError);
            notifyError({
              title: "Session list could not be refreshed",
              message: messages?.[0] ?? refreshError.message,
            });
          }
        );
        return forkedSession.id;
      } catch (error) {
        const mutationError =
          error instanceof Error ? error : new Error("Unknown mutation error");
        const messages = getErrorMessagesFromRelayMutationError(mutationError);
        notifyError({
          title: "Session could not be branched",
          message: messages?.[0] ?? mutationError.message,
        });
        return null;
      } finally {
        store.getState().setSessionOperation(sessionId, null);
      }
    },
    [
      commitFork,
      messages,
      notifyError,
      relayEnvironment,
      runtime,
      sessionId,
      store,
    ]
  );

  const retryMessage = (messageId?: string) => {
    if (
      !sessionId ||
      store.getState().sessionOperationById[sessionId] !== undefined
    ) {
      return;
    }
    const activeChat = getOrCreateRuntimeChat();
    if (!activeChat || isRequestActive(activeChat.status)) {
      return;
    }
    void activeChat.regenerate(messageId ? { messageId } : undefined);
  };

  return {
    messages,
    sendMessage: handleSendMessage,
    stop: handleStopWithToolCleanup,
    status,
    error,
    syncError,
    pendingElicitation,
    handleElicitationSubmit,
    handleElicitationCancel,
    retryMessage,
    rewindToMessage,
    forkFromMessage,
    isSessionOperationPending,
  } as {
    messages: AgentUIMessage[];
    sendMessage: (
      message: { text: string },
      options?: { body?: AgentChatRequestBodyPatch }
    ) => void;
    stop: () => Promise<void>;
    status: ChatStatus;
    error: Error | undefined;
    syncError: Error | null;
    pendingElicitation: PendingElicitation | null;
    handleElicitationSubmit: (output: ElicitToolOutput) => void;
    handleElicitationCancel: () => void;
    retryMessage: (messageId?: string) => void;
    rewindToMessage: (messageId: string) => Promise<string | null>;
    forkFromMessage: (messageId: string) => Promise<string | null>;
    isSessionOperationPending: boolean;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getAgentMessages(value: unknown): AgentUIMessage[] {
  return Array.isArray(value) ? (value as AgentUIMessage[]) : [];
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
