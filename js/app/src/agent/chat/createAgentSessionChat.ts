import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import { commitLocalUpdate } from "react-relay";

import {
  buildAgentChatRequestBody,
  enrichMessageWithClientToolMetadata,
  type AgentModelSelection,
} from "@phoenix/agent/chat/buildAgentChatRequestBody";
import {
  createClientToolTimingRecorder,
  type ClientToolTimingRecorder,
} from "@phoenix/agent/chat/clientToolTimings";
import { handleAgentToolCall } from "@phoenix/agent/chat/handleAgentToolCall";
import {
  partitionPendingClientToolCalls,
  resolveStalePendingToolCallParts,
} from "@phoenix/agent/chat/rehydratePendingToolCalls";
import { shouldSendAutomaticallyAfterToolOutput } from "@phoenix/agent/chat/shouldSendAutomatically";
import { flushToolOutputs } from "@phoenix/agent/chat/toolOutputFlush";
import { createTranscriptPersistenceCoordinator } from "@phoenix/agent/chat/transcriptPersistence";
import { createTurnCompletionGate } from "@phoenix/agent/chat/turnCompletion";
import type {
  AgentUIMessage,
  AgentUIMessagePart,
} from "@phoenix/agent/chat/types";
import { selectActiveContexts } from "@phoenix/agent/context/selectors";
import {
  isRehydratableAgentTool,
  type AgentToolCall,
} from "@phoenix/agent/extensions/toolRegistry";
import { authFetch } from "@phoenix/authFetch";
import {
  readAgentSessionModelSelection,
  readAgentSessionModelSelectionFromFragment,
  shouldNotifyModelChangedElsewhere,
  toAgentModelSelection,
} from "@phoenix/components/agent/agentSessionModel";
import {
  refetchAgentSession,
  type AgentSessionSyncState,
  type RelayEnvironment,
} from "@phoenix/components/agent/agentSessionRelay";
import type { AgentStore } from "@phoenix/store/agentStore";

import {
  SESSION_BUSY_ERROR_CODE,
  SESSION_MESSAGES_STALE_ERROR_CODE,
  SESSION_MODEL_STALE_ERROR_CODE,
  buildAgentChatApiUrl,
  buildAgentToolOutputsApiUrl,
  parseAgentSessionConflictCode,
} from "./agentChatApi";
import { getRemovedUserMessageText } from "./removedUserMessageText";

export type TurnClientState = {
  toolTimings: ReturnType<typeof createClientToolTimingRecorder>;
  recoverPendingToolCalls: () => void;
};

const turnClientStateByChat = new WeakMap<
  Chat<AgentUIMessage>,
  TurnClientState
>();

/**
 * Per-turn client state (client tool timings) owned by a chat built with
 * {@link createAgentSessionChat}, or undefined for other chats.
 */
export function getTurnClientState(
  chat: Chat<AgentUIMessage>
): TurnClientState | undefined {
  return turnClientStateByChat.get(chat);
}

/**
 * Builds the imperative AI SDK chat runtime for a persisted agent session.
 *
 * The closures capture the session's canonical Relay ID, so a draft surface
 * only builds a chat after the create-session mutation returns one. All
 * per-send state is read at request time — never captured — because the chat
 * is cached per-session in the runtime registry and may outlive the surface
 * that created it: capabilities and contexts come from the store, and the
 * model selection comes from the session's Relay record.
 */
export function createAgentSessionChat({
  sessionId,
  seedMessages,
  store,
  relayEnvironment,
  onTranscriptSynced,
}: {
  /** The session's canonical Relay node ID. */
  sessionId: string;
  /** Server transcript used to seed the chat. */
  seedMessages: AgentUIMessage[];
  store: AgentStore;
  relayEnvironment: RelayEnvironment;
  /**
   * Called with the persisted transcript's tail after the turn-completion
   * refetch lands, so the caller's poll can recognize this client's own turn
   * and skip a redundant full fetch.
   */
  onTranscriptSynced: (tail: AgentSessionSyncState) => void;
}): Chat<AgentUIMessage> {
  const chatApiUrl = buildAgentChatApiUrl(sessionId);
  const toolOutputsApiUrl = buildAgentToolOutputsApiUrl(sessionId);
  const toolTimings = createClientToolTimingRecorder();
  // The selection the most recent send asserted, kept so a model-stale
  // rejection can distinguish another client's change from this client
  // racing its own in-flight change.
  let lastAssertedModelSelection: AgentModelSelection | null = null;
  const transcriptPersistence = createTranscriptPersistenceCoordinator();
  const turnCompletionGate = createTurnCompletionGate({
    getShouldSendAutomatically: (messages) =>
      shouldSendAutomaticallyAfterToolOutput({
        messages,
        locallyInterruptedToolCallIds:
          store.getState().locallyInterruptedToolCallIds,
      }),
    endTurn: async () => {
      store.getState().setSessionResponsePending(sessionId, false);
      toolTimings.clear();
    },
    finalize: () => {
      // The server persisted the turn's transcript (and possibly a
      // summarized title); refetch the canonical session record so Relay
      // reflects it.
      void refetchAgentSession({
        environment: relayEnvironment,
        sessionId,
      })
        .then((data) => {
          const agentSession =
            data?.agentSession.__typename === "AgentSession"
              ? data.agentSession
              : null;
          if (agentSession) {
            onTranscriptSynced({
              updatedAt: agentSession.updatedAt,
              lastMessageId: agentSession.lastMessageId,
            });
          }
        })
        .catch(() => {
          // Swallowed on purpose: this refetch is a best-effort cache
          // refresh after the turn's transcript was already persisted
          // server-side, so nothing is lost. The session poll
          // (useAgentSessionSync) probes the same record on its next tick
          // and re-synchronizes Relay and the runtime transcript then.
        });
    },
  });
  /** Execute a tool call in the browser and add its output to the chat. */
  const runAgentToolCall = (toolCall: AgentToolCall) => {
    const isServerExecuted =
      toolCall.providerMetadata?.phoenix?.toolExecutionEnvironment === "server";
    if (!isServerExecuted) {
      toolTimings.recordStart(toolCall.toolCallId);
    }
    void handleAgentToolCall({
      toolCall,
      sessionId,
      addToolOutput: async ({ outcome, ...toolOutput }) => {
        toolTimings.recordEnd(toolCall.toolCallId);
        if (outcome === "interrupted") {
          store.getState().markToolCallInterrupted(toolCall.toolCallId);
        }
        await chat.addToolOutput(toolOutput);
        // Bake the browser-recorded timings into the transcript copy of the
        // resolved part. Request-time enrichment stamps them onto the wire
        // payload only, and the recorder clears when the turn completes, so
        // without this a resend of the output after turn completion (e.g. a
        // new user message re-carrying the preceding assistant message's
        // resolved outputs before the poll syncs the persisted transcript)
        // could not reproduce the persisted part and would be rejected as a
        // divergent result.
        chat.messages = applyClientToolTimingMetadata({
          messages: chat.messages,
          toolCallId: toolCall.toolCallId,
          toolTimings,
        });
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
  };
  const chat = new Chat<AgentUIMessage>({
    id: sessionId,
    messages: seedMessages,
    generateId: () => crypto.randomUUID(),
    transport: new DefaultChatTransport({
      api: chatApiUrl,
      fetch: authFetch,
      prepareSendMessagesRequest: ({ body, id, messages }) => {
        turnCompletionGate.beginTurn();
        store.getState().setSessionResponsePending(sessionId, true);
        store.getState().setSessionNotice(sessionId, null);
        const modelSelection =
          readAgentSessionModelSelection({
            environment: relayEnvironment,
            sessionId,
          }) ?? toAgentModelSelection(store.getState().defaultModelConfig);
        lastAssertedModelSelection = modelSelection;
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
            modelSelection,
            toolTimings,
            locallyInterruptedToolCallIds:
              store.getState().locallyInterruptedToolCallIds,
          }),
        };
      },
    }),
    onToolCall: ({ toolCall }) => {
      runAgentToolCall(toolCall);
    },
    onData: (dataPart) => {
      if (dataPart.type === "data-session-summary") {
        // The stream's summarized title is already persisted server-side;
        // mirror it onto the Relay record so the session list updates live.
        commitLocalUpdate(relayEnvironment, (relayStore) => {
          relayStore.get(sessionId)?.setValue(dataPart.data, "title");
        });
      } else if (dataPart.type === "data-transcript-persisted") {
        transcriptPersistence.acknowledge(dataPart.data);
      }
    },
    sendAutomaticallyWhen: async ({ messages }) => {
      const shouldSendAutomatically =
        await turnCompletionGate.handleSendAutomaticallyWhen({ messages });
      if (!shouldSendAutomatically) {
        const trailingMessage = messages.at(-1);
        if (trailingMessage) {
          flushToolOutputs({
            message: trailingMessage,
            flushUrl: toolOutputsApiUrl,
            fetch: authFetch,
            toolTimings,
            locallyInterruptedToolCallIds:
              store.getState().locallyInterruptedToolCallIds,
          });
        }
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
      const conflictCode = parseAgentSessionConflictCode(error.message);
      const isBusyRejection = conflictCode === SESSION_BUSY_ERROR_CODE;
      const isModelStaleRejection =
        conflictCode === SESSION_MODEL_STALE_ERROR_CODE;
      const isMessagesStaleRejection =
        conflictCode === SESSION_MESSAGES_STALE_ERROR_CODE;
      if (
        !isBusyRejection &&
        !isMessagesStaleRejection &&
        !isModelStaleRejection
      ) {
        return;
      }
      const lastMessage = chat.messages.at(-1);
      if (lastMessage?.role === "user") {
        const restoredInput = getRemovedUserMessageText(
          chat.messages,
          lastMessage.id
        );
        chat.messages = chat.messages.slice(0, -1);
        if (restoredInput) {
          store.getState().setDraftInput(sessionId, restoredInput);
        }
      }
      // Deferred: the SDK assigns its error state around this callback, so
      // a synchronous clearError would be clobbered and the inline
      // "response failed" banner would still render.
      queueMicrotask(() => {
        chat.clearError();
      });
      if (isMessagesStaleRejection) {
        // Raise the refreshed-from-stale notice now; it renders once the
        // poll exits busy mode with the fresh transcript in place, and
        // clears on the next send.
        store.getState().setSessionNotice(sessionId, "messagesAddedElsewhere");
      }
      if (isModelStaleRejection) {
        const assertedModel = lastAssertedModelSelection;
        void refetchAgentSession({
          environment: relayEnvironment,
          sessionId,
        }).then((data) => {
          const agentSession =
            data?.agentSession.__typename === "AgentSession"
              ? data.agentSession
              : null;
          if (!agentSession) {
            return;
          }
          const shouldNotify = shouldNotifyModelChangedElsewhere({
            assertedModel,
            refetchedModel:
              readAgentSessionModelSelectionFromFragment(agentSession),
            currentModel: readAgentSessionModelSelection({
              environment: relayEnvironment,
              sessionId,
            }),
          });
          if (shouldNotify) {
            store
              .getState()
              .setSessionNotice(sessionId, "modelChangedElsewhere");
          }
        });
        return;
      }
      store.getState().setSessionBusyElsewhere(sessionId, true);
    },
    onFinish: ({ messages: finalMessages, message }) => {
      turnCompletionGate.handleFinish({ finalMessages, message });
    },
  });
  const lastSeedMessage = seedMessages[seedMessages.length - 1];
  if (lastSeedMessage?.role === "assistant") {
    // don't trigger a continuation of the conversation on load
    transcriptPersistence.acknowledge({ messageId: lastSeedMessage.id });
  }
  const recoverPendingToolCalls = () => {
    const { rehydratableToolCalls, staleToolCalls } =
      partitionPendingClientToolCalls({
        messages: chat.messages,
        isRehydratableTool: isRehydratableAgentTool,
        isToolCallInFlight: toolTimings.isInFlight,
      });
    for (const toolCall of rehydratableToolCalls) {
      runAgentToolCall(toolCall);
    }
    chat.messages = resolveStalePendingToolCallParts({
      messages: chat.messages,
      staleToolCallIds: new Set(
        staleToolCalls.map((toolCall) => toolCall.toolCallId)
      ),
    });
  };
  recoverPendingToolCalls();
  turnClientStateByChat.set(chat, { toolTimings, recoverPendingToolCalls });
  return chat;
}

/**
 * Write the recorder's timing metadata for a resolved tool call back into the
 * message that owns it, using the same enrichment the request payload gets so
 * the local part stays byte-identical to what the server persists.
 */
export function applyClientToolTimingMetadata({
  messages,
  toolCallId,
  toolTimings,
}: {
  messages: AgentUIMessage[];
  toolCallId: string;
  toolTimings: ClientToolTimingRecorder;
}): AgentUIMessage[] {
  const messageIndex = messages.findIndex((message) =>
    message.parts.some(
      (part) => isToolUIPart(part) && part.toolCallId === toolCallId
    )
  );
  if (messageIndex === -1) {
    return messages;
  }
  const enrichedMessage = enrichMessageWithClientToolMetadata({
    message: messages[messageIndex],
    toolTimings,
  });
  if (enrichedMessage === messages[messageIndex]) {
    return messages;
  }
  return messages.map((message, index) =>
    index === messageIndex ? enrichedMessage : message
  );
}

function appendPartToToolMessage({
  messages,
  toolCallId,
  part,
}: {
  messages: AgentUIMessage[];
  toolCallId: string;
  part: AgentUIMessagePart;
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
