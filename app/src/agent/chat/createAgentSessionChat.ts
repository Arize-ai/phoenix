import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import { commitLocalUpdate } from "react-relay";

import {
  buildAgentChatRequestBody,
  type AgentModelSelection,
} from "@phoenix/agent/chat/buildAgentChatRequestBody";
import { createClientToolTimingRecorder } from "@phoenix/agent/chat/clientToolTimings";
import { handleAgentToolCall } from "@phoenix/agent/chat/handleAgentToolCall";
import { createToolOutputFlusher } from "@phoenix/agent/chat/toolOutputFlush";
import { createTranscriptPersistenceCoordinator } from "@phoenix/agent/chat/transcriptPersistence";
import { createTurnCompletionGate } from "@phoenix/agent/chat/turnCompletion";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { selectActiveContexts } from "@phoenix/agent/context/selectors";
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
import { isRecord } from "@phoenix/utils/typeUtils";

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
  const toolTimings = createClientToolTimingRecorder();
  // Persists each resolved client tool output (e.g. the first of several
  // approvals) while sibling calls are still pending, so the server-side
  // transcript reflects it before the turn's final chat continuation.
  const toolOutputFlusher = createToolOutputFlusher({
    flushUrl: buildAgentToolOutputsApiUrl(sessionId),
    fetch: authFetch,
    toolTimings,
  });
  // The selection the most recent send asserted, kept so a model-stale
  // rejection can distinguish another client's change from this client
  // racing its own in-flight change.
  let lastAssertedModelSelection: AgentModelSelection | null = null;
  const transcriptPersistence = createTranscriptPersistenceCoordinator();
  const turnCompletionGate = createTurnCompletionGate({
    endTurn: async () => {
      store.getState().setSessionResponsePending(sessionId, false);
      toolTimings.clear();
      toolOutputFlusher.clear();
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
        // The turn is not continuing yet; persist any newly resolved client
        // tool outputs while their siblings stay pending.
        toolOutputFlusher.maybeFlush(messages);
        return false;
      }
      const assistantMessage = messages.at(-1);
      if (assistantMessage?.role !== "assistant") {
        return false;
      }
      const transcriptPersisted = await transcriptPersistence.waitForMessage({
        messageId: assistantMessage.id,
      });
      if (!transcriptPersisted) {
        return false;
      }
      // The continuation carries no outputs of its own, so every resolved
      // output must land on the tool_outputs route first. On persistent flush
      // failure the continuation still fires: the server rejects it with a
      // visible agent_session_tool_outputs_pending conflict instead of the
      // turn stalling silently.
      await toolOutputFlusher.flushAndWait(messages);
      return true;
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
  turnClientStateByChat.set(chat, { toolTimings });
  return chat;
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
