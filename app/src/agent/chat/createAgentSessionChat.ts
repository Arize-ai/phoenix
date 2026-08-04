import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import { commitLocalUpdate } from "react-relay";

import { buildAgentChatRequestBody } from "@phoenix/agent/chat/buildAgentChatRequestBody";
import { createClientToolTimingRecorder } from "@phoenix/agent/chat/clientToolTimings";
import { handleAgentToolCall } from "@phoenix/agent/chat/handleAgentToolCall";
import { createTranscriptPersistenceCoordinator } from "@phoenix/agent/chat/transcriptPersistence";
import { createTurnCompletionGate } from "@phoenix/agent/chat/turnCompletion";
import { createTurnTraceContextManager } from "@phoenix/agent/chat/turnTraceContext";
import {
  getAssistantMessageMetadata,
  type AgentUIMessage,
} from "@phoenix/agent/chat/types";
import { selectActiveContexts } from "@phoenix/agent/context/selectors";
import { authFetch } from "@phoenix/authFetch";
import {
  refetchAgentSession,
  type AgentSessionSyncState,
  type RelayEnvironment,
} from "@phoenix/components/agent/agentSessionRelay";
import { selectAgentModel } from "@phoenix/components/agent/useAgentChatPanelState";
import type { AgentStore } from "@phoenix/store/agentStore";
import { isRecord } from "@phoenix/utils/typeUtils";

import {
  SESSION_BUSY_ERROR_CODE,
  SESSION_STALE_ERROR_CODE,
  buildAgentChatApiUrl,
} from "./agentChatApi";
import { getRemovedUserMessageText } from "./removedUserMessageText";

export type TurnClientState = {
  turnTraceContext: ReturnType<typeof createTurnTraceContextManager>;
  toolTimings: ReturnType<typeof createClientToolTimingRecorder>;
};

const turnClientStateByChat = new WeakMap<
  Chat<AgentUIMessage>,
  TurnClientState
>();

/**
 * Per-turn client state (trace context, client tool timings) owned by a chat
 * built with {@link createAgentSessionChat}, or undefined for other chats.
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
 * per-send state (model selection, capabilities, contexts) is read from the
 * store at request time — never captured — because the chat is cached
 * per-session in the runtime registry and may outlive the surface that
 * created it.
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
  const turnTraceContext = createTurnTraceContextManager();
  const toolTimings = createClientToolTimingRecorder();
  const transcriptPersistence = createTranscriptPersistenceCoordinator();
  const turnCompletionGate = createTurnCompletionGate({
    endTurn: async () => {
      store.getState().setSessionResponsePending(sessionId, false);
      turnTraceContext.clear();
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
  const chat = new Chat<AgentUIMessage>({
    id: sessionId,
    messages: seedMessages,
    generateId: () => crypto.randomUUID(),
    transport: new DefaultChatTransport({
      api: chatApiUrl,
      fetch: authFetch,
      prepareSendMessagesRequest: ({ body, id, messages }) => {
        // The gate may clear state for a stale completed turn before
        // this request reads the active turn trace context.
        turnCompletionGate.beginTurn();
        store.getState().setSessionResponsePending(sessionId, true);
        // A fresh send supersedes any lingering stale-refresh notice.
        store.getState().setSessionRefreshedFromStale(sessionId, false);
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
            // Read from the store at request time — never captured (see the
            // factory doc comment).
            modelSelection: selectAgentModel(store.getState()),
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
      const isBusyRejection = error.message.includes(SESSION_BUSY_ERROR_CODE);
      const isStaleRejection = error.message.includes(SESSION_STALE_ERROR_CODE);
      if (!isBusyRejection && !isStaleRejection) {
        return;
      }
      // A session-conflict rejection (HTTP 409): either another client's
      // turn holds the session lock, or this client's transcript went
      // stale because another client appended to the session. Withdraw
      // the optimistic user message into the composer draft and enter
      // busy-elsewhere mode; the session poll fetches the fresh transcript
      // and swaps it in (immediately for a stale send with no live turn,
      // or once the other client's turn completes).
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
      if (isStaleRejection) {
        // Raise the refreshed-from-stale notice now; it renders once the
        // poll exits busy mode with the fresh transcript in place, and
        // clears on the next send.
        store.getState().setSessionRefreshedFromStale(sessionId, true);
      }
      store.getState().setSessionBusyElsewhere(sessionId, true);
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
