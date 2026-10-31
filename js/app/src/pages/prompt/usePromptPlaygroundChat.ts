import type { ChatStatus } from "ai";
import { useEffect, useRef, useState } from "react";
import { useRelayEnvironment } from "react-relay";
import type { Disposable } from "relay-runtime";
import { requestSubscription } from "relay-runtime";

import { getTemplateFormatUtils } from "@phoenix/components/templateEditor/templateEditorUtils";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import type { DirectChatMessage } from "@phoenix/pages/chat/useDirectChat";
import type {
  ChatCompletionInput,
  PlaygroundOutputSubscription as PlaygroundOutputSubscriptionType,
} from "@phoenix/pages/playground/__generated__/PlaygroundOutputSubscription.graphql";
import PlaygroundOutputSubscription from "@phoenix/pages/playground/__generated__/PlaygroundOutputSubscription.graphql";
import { getChatCompletionInput } from "@phoenix/pages/playground/playgroundUtils";
import { getErrorMessagesFromRelaySubscriptionError } from "@phoenix/utils/errorUtils";
import { generateUUID } from "@phoenix/utils/uuidUtils";

type ToolCall = { id: string; name: string; arguments: string };

/**
 * Renders the tool calls a reply made, since a chat has no tool runner to
 * hand them to
 */
function formatToolCalls(toolCalls: ToolCall[]): string {
  return toolCalls
    .map(
      (toolCall) =>
        `**Tool call** \`${toolCall.name}\`\n\n\`\`\`json\n${toolCall.arguments}\n\`\`\``
    )
    .join("\n\n");
}

/**
 * Builds the chat completion input for a turn. The prompt's own messages are
 * formatted here so the server receives no template options and never runs
 * the conversation, which is free text, through the template formatter.
 */
export function buildPromptPlaygroundChatInput(
  baseInput: ChatCompletionInput,
  history: DirectChatMessage[]
): ChatCompletionInput {
  const { template, promptVersion } = baseInput;
  const formatText =
    template != null
      ? (text: string) =>
          getTemplateFormatUtils(template.format).format({
            text,
            variables: template.variables ?? {},
          })
      : (text: string) => text;
  return {
    ...baseInput,
    template: null,
    promptVersion: {
      ...promptVersion,
      template: {
        ...promptVersion.template,
        messages: [
          ...promptVersion.template.messages.map((message) => ({
            ...message,
            content: message.content.map((part) =>
              part.text != null
                ? { text: { text: formatText(part.text.text) } }
                : part
            ),
          })),
          ...history.map((message) => ({
            role: message.role === "user" ? ("USER" as const) : ("AI" as const),
            content: [{ text: { text: message.content } }],
          })),
        ],
      },
    },
    repetitions: 1,
    streamModelOutput: true,
  };
}

/**
 * A chat with the prompt being edited in the surrounding playground. Each
 * turn runs the playground's chat completion with the conversation appended
 * to the prompt's messages, so the reply reflects the prompt exactly as it is
 * on screen: its model, parameters, tools, response format, and variables.
 * The conversation lives in memory only.
 */
export function usePromptPlaygroundChat({
  instanceId,
}: {
  instanceId: number;
}) {
  const environment = useRelayEnvironment();
  const playgroundStore = usePlaygroundStore();
  const credentials = useCredentialsContext((state) => state);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<DirectChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<Disposable | null>(null);

  useEffect(() => {
    const subscription = subscriptionRef;
    return () => {
      subscription.current?.dispose();
    };
  }, []);

  const run = (history: DirectChatMessage[]) => {
    subscriptionRef.current?.dispose();
    setMessages(history);
    setStatus("submitted");
    setError(null);
    const baseInput = getChatCompletionInput({
      playgroundStore,
      instanceId,
      credentials,
    });
    const input = buildPromptPlaygroundChatInput(baseInput, history);
    const assistantId = generateUUID();
    let text = "";
    const toolCalls: ToolCall[] = [];
    let hasStarted = false;
    const flush = () => {
      const content = [text, formatToolCalls(toolCalls)]
        .filter(Boolean)
        .join("\n\n");
      if (!hasStarted) {
        hasStarted = true;
        setStatus("streaming");
        setMessages([
          ...history,
          { id: assistantId, role: "assistant", content },
        ]);
        return;
      }
      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantId ? { ...message, content } : message
        )
      );
    };
    let subscription: Disposable | null = null;
    const ownsChat = () => subscriptionRef.current === subscription;
    subscription = requestSubscription<PlaygroundOutputSubscriptionType>(
      environment,
      {
        subscription: PlaygroundOutputSubscription,
        variables: { input },
        onNext: (response) => {
          const chatCompletion = response?.chatCompletion;
          if (chatCompletion == null || !ownsChat()) {
            return;
          }
          switch (chatCompletion.__typename) {
            case "TextChunk":
              text += chatCompletion.content ?? "";
              flush();
              return;
            case "ToolCallChunk": {
              const { id, function: toolFunction } = chatCompletion;
              if (id == null || toolFunction == null) {
                return;
              }
              const existing = toolCalls.find((toolCall) => toolCall.id === id);
              if (existing) {
                existing.arguments += toolFunction.arguments;
              } else {
                toolCalls.push({
                  id,
                  name: toolFunction.name,
                  arguments: toolFunction.arguments,
                });
              }
              flush();
              return;
            }
            case "ChatCompletionSubscriptionError":
              setError(chatCompletion.message ?? "Chat completion failed");
              setStatus("error");
              return;
          }
        },
        onCompleted: () => {
          if (!ownsChat()) {
            return;
          }
          subscriptionRef.current = null;
          setStatus((previous) => (previous === "error" ? previous : "ready"));
        },
        onError: (subscriptionError) => {
          if (!ownsChat()) {
            return;
          }
          subscriptionRef.current = null;
          const errorMessages =
            getErrorMessagesFromRelaySubscriptionError(subscriptionError);
          setError(
            errorMessages != null && errorMessages.length > 0
              ? errorMessages.join("\n")
              : subscriptionError.message
          );
          setStatus("error");
        },
      }
    );
    subscriptionRef.current = subscription;
  };

  const isBusy = status === "submitted" || status === "streaming";

  /** Sends a user message and streams the reply. */
  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) {
      return;
    }
    run([...messages, { id: generateUUID(), role: "user", content: trimmed }]);
  };

  /** Re-sends the conversation from the latest user message. */
  const retry = () => {
    if (isBusy) {
      return;
    }
    const lastUserIndex = messages.findLastIndex(
      (message) => message.role === "user"
    );
    if (lastUserIndex === -1) {
      return;
    }
    run(messages.slice(0, lastUserIndex + 1));
  };

  /** Stops the reply in progress, keeping what has streamed in. */
  const stop = () => {
    subscriptionRef.current?.dispose();
    subscriptionRef.current = null;
    setStatus("ready");
  };

  /** Discards the conversation. */
  const clear = () => {
    stop();
    setMessages([]);
    setError(null);
  };

  return {
    draft,
    setDraft,
    messages,
    status,
    error,
    sendMessage,
    retry,
    stop,
    clear,
  };
}
