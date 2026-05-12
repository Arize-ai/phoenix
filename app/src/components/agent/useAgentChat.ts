import { Chat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import { isToolUIPart } from "ai";
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react";

import { buildAgentChatRequestBody } from "@phoenix/agent/chat/buildAgentChatRequestBody";
import { handleAgentToolCall } from "@phoenix/agent/chat/handleAgentToolCall";
import {
  getUnresolvedToolCalls,
  type UnresolvedToolCall,
} from "@phoenix/agent/chat/interruptToolCalls";
import { PhoenixAgentChatTransport } from "@phoenix/agent/chat/PhoenixAgentChatTransport";
import {
  shouldSendAutomaticallyAfterToolOutput,
  SYSTEM_INTERRUPT_ERROR,
  USER_INTERRUPT_ERROR,
} from "@phoenix/agent/chat/shouldSendAutomatically";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { selectActiveContexts } from "@phoenix/agent/context/selectors";
import type {
  ElicitToolOutput,
  PendingElicitation,
} from "@phoenix/agent/tools/elicit";
import { EDIT_PROMPT_TOOL_NAME } from "@phoenix/agent/tools/playgroundPrompt";
import { authFetch } from "@phoenix/authFetch";
import {
  type AgentChatRuntimeChat,
  type AgentChatTurn,
  useAgentChatRuntime,
} from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";

import {
  useGenerateSessionSummary,
  type ChatSearchParams,
} from "./useGenerateSessionSummary";

type AddToolOutput = Chat<AgentUIMessage>["addToolOutput"];
const EMPTY_MESSAGES: AgentUIMessage[] = [];

export function createGuardedAddToolOutput({
  addToolOutput,
  turn,
}: {
  addToolOutput: AddToolOutput;
  turn: AgentChatTurn;
}): AddToolOutput {
  return async (output: Parameters<AddToolOutput>[0]) => {
    if (!turn.isCurrent()) {
      return;
    }
    return addToolOutput(output);
  };
}

export function shouldSendAutomaticallyForTurn({
  messages,
  turn,
}: {
  messages: AgentUIMessage[];
  turn: AgentChatTurn;
}): boolean {
  if (!turn.isCurrent()) {
    return false;
  }
  return shouldSendAutomaticallyAfterToolOutput({ messages });
}

function useRuntimeChat(chatInstance: Chat<AgentUIMessage> | null) {
  const subscribeToMessages = useCallback(
    (update: () => void) => {
      return (
        chatInstance?.["~registerMessagesCallback"](update) ?? (() => undefined)
      );
    },
    [chatInstance]
  );
  const subscribeToStatus = useCallback(
    (update: () => void) => {
      return (
        chatInstance?.["~registerStatusCallback"](update) ?? (() => undefined)
      );
    },
    [chatInstance]
  );
  const subscribeToError = useCallback(
    (update: () => void) => {
      return (
        chatInstance?.["~registerErrorCallback"](update) ?? (() => undefined)
      );
    },
    [chatInstance]
  );

  const messages = useSyncExternalStore(
    subscribeToMessages,
    () => chatInstance?.messages ?? EMPTY_MESSAGES,
    () => EMPTY_MESSAGES
  );
  const status = useSyncExternalStore(
    subscribeToStatus,
    () => chatInstance?.status ?? "ready",
    () => "ready"
  );
  const error = useSyncExternalStore(
    subscribeToError,
    () => chatInstance?.error,
    () => undefined
  );

  return { messages, status, error };
}

/**
 * Subscribes the current render surface to the persistent AI SDK chat runtime
 * for a single agent session/model pair.
 *
 * A component-owned AI SDK chat is too short-lived for this agent UX: the
 * visible chat surface can move between the docked panel and the trace
 * slideover, and model changes intentionally replace the underlying transport.
 * This hook keeps the imperative AI SDK `Chat` instance in the app-level
 * runtime registry, then binds the current React surface to whichever runtime
 * instance should own the session right now.
 *
 * Durable state still lives in the agent store:
 * - messages are mirrored into Zustand so an idle chat can be reconstructed
 * - pending elicitation is store-backed and survives remounts
 * - summaries are generated from finalized message history, not transient UI
 *   component state
 */
export function useAgentChat({
  sessionId,
  chatApiUrl,
  chatSearchParams,
}: {
  sessionId: string | null;
  chatApiUrl: string;
  chatSearchParams: ChatSearchParams;
}) {
  const store = useAgentStore();
  const runtime = useAgentChatRuntime();
  const { generateSummary } = useGenerateSessionSummary({ chatSearchParams });
  const [, forceChatBinding] = useReducer((version: number) => version + 1, 0);
  const pendingElicitation = useAgentContext((state) =>
    sessionId ? (state.pendingElicitationBySessionId[sessionId] ?? null) : null
  );

  const createChat = (turn: AgentChatTurn) => {
    // Rehydrate from store-backed messages so evicted idle runtimes can
    // be recreated without losing visible conversation history.
    const initialMessages =
      sessionId == null
        ? []
        : (store.getState().sessionMap[sessionId]?.messages ?? []);
    const chatRef: { current: Chat<AgentUIMessage> | null } = {
      current: null,
    };
    const guardedAddToolOutput = createGuardedAddToolOutput({
      addToolOutput: async (output) => {
        await chatRef.current?.addToolOutput(output);
      },
      turn,
    });
    const chat = new Chat<AgentUIMessage>({
      id: sessionId ?? "agent-chat",
      messages: initialMessages,
      transport: new PhoenixAgentChatTransport({
        api: chatApiUrl,
        fetch: authFetch,
        prepareSendMessagesRequest: ({
          body,
          id,
          messages,
          trigger,
          messageId,
        }) => ({
          body: buildAgentChatRequestBody({
            body,
            id,
            messages,
            trigger,
            messageId,
            capabilities: store.getState().capabilities,
            observability: store.getState().observability,
            hasRemoteCollector: Boolean(
              store.getState().agentsConfig.collectorEndpoint
            ),
            contexts: selectActiveContexts(store.getState()),
          }),
        }),
      }),
      // Tool execution must target the runtime-owned chat instance so
      // tool outputs continue to attach to the correct conversation
      // even if the visible React surface remounts during the request.
      onToolCall: ({ toolCall }) => {
        if (!turn.isCurrent()) {
          return;
        }
        void handleAgentToolCall({
          toolCall,
          sessionId,
          addToolOutput: guardedAddToolOutput,
          agentStore: store,
        });
      },
      sendAutomaticallyWhen: ({ messages }) => {
        return shouldSendAutomaticallyForTurn({ messages, turn });
      },
      onFinish: ({
        messages: finalMessages,
        message,
        isAbort,
        isDisconnect,
        isError,
      }) => {
        if (!turn.isCurrent() || isAbort || isDisconnect || isError) {
          return;
        }
        if (!sessionId) {
          return;
        }
        const usage = message.metadata?.usage;
        if (usage != null) {
          store.getState().setSessionUsage(sessionId, {
            ...usage.tokens,
            ...(usage.promptDetails
              ? { promptDetails: usage.promptDetails }
              : {}),
          });
        }
        // Finalized history is mirrored into the durable store so idle
        // runtimes can be reclaimed and later reconstructed from state.
        if (finalMessages) {
          store.getState().setSessionMessages(sessionId, finalMessages);
          generateSummary({ sessionId });
        }
      },
    });
    chatRef.current = chat;
    return chat;
  };

  // Resolve the imperative runtime instance for this session/model pair. The
  // runtime owns replacement semantics when the transport changes, while the
  // hook simply binds the current render surface to the selected instance.
  const runtimeChat =
    sessionId === null
      ? null
      : runtime.getOrCreateChat({
          sessionId,
          chatApiUrl,
          createChat,
        });
  const chatInstance = runtimeChat?.chat ?? null;

  const { messages, status, error } = useRuntimeChat(chatInstance);

  const clearInterruptedToolState = ({
    interruptedToolCalls,
  }: {
    interruptedToolCalls: ReturnType<typeof getUnresolvedToolCalls>;
  }) => {
    interruptedToolCalls.forEach((toolCall) => {
      if (toolCall.tool === EDIT_PROMPT_TOOL_NAME) {
        // The generic interruption output resolves the AI SDK tool call; clear
        // the live approval state too so stale Accept/Reject actions disappear.
        store.getState().setPendingPromptEdit(toolCall.toolCallId, null);
      }
      if (toolCall.tool === "ask_user" && sessionId) {
        store.getState().setPendingElicitation(sessionId, null);
      }
    });
  };

  const interruptActiveChat = async ({
    errorText,
  }: {
    errorText: string;
  }): Promise<AgentChatRuntimeChat | null> => {
    if (!sessionId || !runtimeChat) {
      return null;
    }

    const latestMessages = runtimeChat.chat.messages.length
      ? runtimeChat.chat.messages
      : messages;
    const { messages: interruptedMessages, interruptedToolCalls } =
      resolveInterruptedMessages({
        messages: latestMessages,
        errorText,
      });
    clearInterruptedToolState({ interruptedToolCalls });

    if (isRequestActive(runtimeChat.chat.status)) {
      await runtimeChat.chat.stop();
    }

    runtimeChat.chat.messages = interruptedMessages;
    store.getState().setSessionMessages(sessionId, interruptedMessages);

    const nextRuntimeChat = runtime.replaceChat({
      sessionId,
      chatApiUrl,
      createChat,
    });
    forceChatBinding();
    return nextRuntimeChat;
  };

  const handleStopWithToolCleanup = async () => {
    await interruptActiveChat({ errorText: USER_INTERRUPT_ERROR });
  };

  const handleSendMessage = async (
    ...args: Parameters<Chat<AgentUIMessage>["sendMessage"]>
  ) => {
    let targetChat = chatInstance;
    if (runtimeChat && isRequestActive(runtimeChat.chat.status)) {
      const nextRuntimeChat = await interruptActiveChat({
        errorText: SYSTEM_INTERRUPT_ERROR,
      });
      targetChat = nextRuntimeChat?.chat ?? null;
    }

    await targetChat?.sendMessage(...args);
  };

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Persist the latest in-memory transcript when this binding unmounts because
  // the visible surface moved, the active session changed, or the model swap
  // caused the runtime instance to be replaced.
  useEffect(() => {
    return () => {
      if (sessionId && messagesRef.current.length > 0) {
        store.getState().setSessionMessages(sessionId, messagesRef.current);
      }
    };
  }, [sessionId, store]);

  // Elicitation responses are written back through the runtime-owned chat so
  // the pending tool call resolves against the correct assistant turn.
  const handleElicitationSubmit = (output: ElicitToolOutput) => {
    if (!pendingElicitation || !sessionId || !runtimeChat?.isCurrent()) {
      return;
    }
    void runtimeChat.chat.addToolOutput({
      tool: "ask_user",
      toolCallId: pendingElicitation.toolCallId,
      output,
    });
    store.getState().setPendingElicitation(sessionId, null);
  };

  const handleElicitationCancel = () => {
    if (!pendingElicitation || !sessionId || !runtimeChat?.isCurrent()) {
      return;
    }
    void runtimeChat.chat.addToolOutput({
      state: "output-error",
      tool: "ask_user",
      toolCallId: pendingElicitation.toolCallId,
      errorText: "User cancelled the question.",
    });
    store.getState().setPendingElicitation(sessionId, null);
  };

  return {
    messages,
    sendMessage: handleSendMessage,
    stop: handleStopWithToolCleanup,
    status,
    error,
    pendingElicitation,
    handleElicitationSubmit,
    handleElicitationCancel,
  } as {
    messages: AgentUIMessage[];
    sendMessage: (message: { text: string }) => Promise<void>;
    stop: () => Promise<void>;
    status: ChatStatus;
    error: Error | undefined;
    pendingElicitation: PendingElicitation | null;
    handleElicitationSubmit: (output: ElicitToolOutput) => void;
    handleElicitationCancel: () => void;
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

export function resolveInterruptedMessages({
  messages,
  errorText,
}: {
  messages: AgentUIMessage[];
  errorText: string;
}): {
  messages: AgentUIMessage[];
  interruptedToolCalls: UnresolvedToolCall[];
} {
  const interruptedToolCalls = getUnresolvedToolCalls(messages);
  if (interruptedToolCalls.length === 0) {
    return { messages, interruptedToolCalls };
  }

  const interruptedToolCallIds = new Set(
    interruptedToolCalls.map((toolCall) => toolCall.toolCallId)
  );

  return {
    interruptedToolCalls,
    messages: removeInterruptedToolInputParts(
      messages.map((message, messageIndex) => {
        const isLastMessage = messageIndex === messages.length - 1;
        if (!isLastMessage || message.role !== "assistant") {
          return message;
        }
        return {
          ...message,
          parts: message.parts.map((part) => {
            if (
              !isToolUIPart(part) ||
              !interruptedToolCallIds.has(part.toolCallId)
            ) {
              return part;
            }
            const input =
              "input" in part && part.input != null ? part.input : {};
            return {
              ...part,
              state: "output-error",
              input,
              errorText,
            } as typeof part;
          }),
        };
      })
    ),
  };
}

function isRequestActive(status: ChatStatus): boolean {
  return status === "submitted" || status === "streaming";
}
