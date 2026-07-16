import { Chat, useChat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { useCallback, useRef } from "react";
import { graphql, useMutation, useRelayEnvironment } from "react-relay";

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
import { useAgentChatRuntime } from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { useAgentChatForkMutation } from "./__generated__/useAgentChatForkMutation.graphql";
import type { useAgentChatTruncateMutation } from "./__generated__/useAgentChatTruncateMutation.graphql";
import { refetchAgentSessions } from "./agentSessionRelay";

type TurnClientState = {
  turnTraceContext: TurnTraceContextManager;
  toolTimings: ClientToolTimingRecorder;
};

const turnClientStateByChat = new WeakMap<
  Chat<AgentUIMessage>,
  TurnClientState
>();

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
  const runtime = useAgentChatRuntime();
  const relayEnvironment = useRelayEnvironment();
  const notifyError = useNotifyError();
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

  // The Chat is cached per-session in the runtime registry, so its transport
  // and onFinish closures are captured once and reused across model changes.
  // Read through the ref so the latest model selection takes effect on the
  // next send without rebuilding the Chat.
  const modelSelectionRef = useRef(modelSelection);
  modelSelectionRef.current = modelSelection;

  // Resolve the imperative runtime instance for this session/model pair. The
  // runtime owns replacement semantics when the transport changes, while the
  // hook simply binds the current render surface to the selected instance.
  const chatInstance =
    sessionId === null
      ? null
      : runtime.getOrCreateChat({
          sessionId,
          chatApiUrl,
          createChat: () => {
            const runtimeMessages = initialMessages ?? [];
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
                      agentSessionId:
                        store.getState().sessionMap[sessionId]?.id ?? null,
                      messages,
                      trigger,
                      messageId,
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
                  "providerMetadata" in toolCall
                    ? toolCall.providerMetadata
                    : null;
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
                if (dataPart.type === "data-session-created") {
                  store
                    .getState()
                    .setSessionPersisted(sessionId, dataPart.data.id);
                  void refetchAgentSessions({ environment: relayEnvironment });
                  return;
                }
                if (dataPart.type === "data-session-summary") {
                  store.getState().updateSessionTitle(sessionId, dataPart.data);
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

  // `useChat` subscribes the current React tree to the already-created runtime
  // instance. When `sessionId` is null we intentionally expose an inert chat
  // shape rather than creating a shared fallback runtime through this hook.
  const chat = useChat<AgentUIMessage>(
    chatInstance ? { chat: chatInstance } : { id: undefined, messages: [] }
  );
  const {
    messages,
    sendMessage,
    regenerate,
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

  const handleSendMessage = async (...args: Parameters<typeof sendMessage>) => {
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

  // Rewinds the active session in place to the chosen message, truncating the
  // transcript and releasing stale tool state. Returns the user message text to
  // restore into the input (user target) or null (assistant target / no-op).
  const rewindToMessage = useCallback(
    (messageId: string): string | null => {
      if (!sessionId || !chatInstance || isRequestActive(chatInstance.status)) {
        return null;
      }
      const result = rewindMessages({
        messages: chatInstance.messages,
        messageId,
      });
      if (!result) {
        return null;
      }
      const persistedSessionId = store.getState().sessionMap[sessionId]?.id;
      if (persistedSessionId) {
        const previousMessages = chatInstance.messages;
        commitTruncate({
          variables: {
            id: persistedSessionId,
            lastMessageId: result.messages.at(-1)?.id ?? null,
          },
          onError: (error) => {
            setMessages(previousMessages);
            const messages = getErrorMessagesFromRelayMutationError(error);
            notifyError({
              title: "Session could not be rewound",
              message: messages?.[0] ?? error.message,
            });
          },
        });
      }
      clearDroppedToolState({
        previous: chatInstance.messages,
        next: result.messages,
      });
      setMessages(result.messages);
      clearError();
      return result.restoredInput;
    },
    [
      chatInstance,
      clearDroppedToolState,
      clearError,
      commitTruncate,
      notifyError,
      sessionId,
      setMessages,
      store,
    ]
  );

  // Branches the active session into a new session truncated to the chosen
  // message, leaving the current session untouched. Returns the new session id.
  const forkFromMessage = useCallback(
    (messageId: string): string | null => {
      if (!sessionId || !chatInstance) {
        return null;
      }
      const result = rewindMessages({
        messages: chatInstance.messages,
        messageId,
      });
      if (!result) {
        return null;
      }
      clearError();
      const sourceSession = store.getState().sessionMap[sessionId];
      if (!sourceSession?.id) {
        notifyError({
          title: "Session could not be branched",
          message: "The session must be persisted before it can be branched.",
        });
        return null;
      }
      commitFork({
        variables: {
          sourceSessionId: sourceSession.id,
          lastMessageId: result.messages.at(-1)?.id ?? null,
        },
        onCompleted: (response) => {
          const forkedSession = response.forkAgentSession.agentSession;
          store.getState().cacheSession({
            clientKey: forkedSession.id,
            id: forkedSession.id,
            title: forkedSession.title,
            context: [...sourceSession.context],
            modelConfig: { ...sourceSession.modelConfig },
            createdAt: Date.parse(forkedSession.createdAt as string),
          });
          if (result.restoredInput) {
            store
              .getState()
              .setDraftInput(forkedSession.id, result.restoredInput);
          }
          store.getState().setActiveSession(forkedSession.id);
          void refetchAgentSessions({ environment: relayEnvironment });
        },
        onError: (error) => {
          const messages = getErrorMessagesFromRelayMutationError(error);
          notifyError({
            title: "Session could not be branched",
            message: messages?.[0] ?? error.message,
          });
        },
      });
      return null;
    },
    [
      chatInstance,
      clearError,
      commitFork,
      notifyError,
      relayEnvironment,
      sessionId,
      store,
    ]
  );

  const retryMessage = useCallback(
    (messageId?: string) => {
      if (!sessionId || !chatInstance || isRequestActive(chatInstance.status)) {
        return;
      }
      void regenerate(messageId ? { messageId } : undefined);
    },
    [chatInstance, regenerate, sessionId]
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
    retryMessage,
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
    retryMessage: (messageId?: string) => void;
    rewindToMessage: (messageId: string) => string | null;
    forkFromMessage: (messageId: string) => string | null;
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
