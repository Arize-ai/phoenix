import { Box, Text, useApp, useInput } from "ink";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { createPxiChatClient, createUserMessage } from "./client";
import { Markdown } from "./inkMarkdown";
import { getToolProgressFromPart, type ToolProgress } from "./toolProgress";
import type { PxiChatClient, PxiMessage, PxiRuntimeOptions } from "./types";

type PxiStatus = "idle" | "streaming";

const THINKING_FRAMES = [
  "PXI is thinking   ",
  "PXI is thinking.  ",
  "PXI is thinking.. ",
  "PXI is thinking...",
];

export type PxiAppProps = {
  options: PxiRuntimeOptions;
  client?: PxiChatClient;
  initialMessages?: PxiMessage[];
};

function getModelLabel(options: PxiRuntimeOptions): string {
  if (options.modelSelection.providerType === "custom") {
    return `custom:${options.modelSelection.providerId}/${options.modelSelection.modelName}`;
  }
  return `${options.modelSelection.provider}/${options.modelSelection.modelName}`;
}

function InlineToolProgress({ tool }: { tool: ToolProgress }) {
  const statusColor = tool.state === "output-error" ? "red" : "yellow";
  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2}>
      <Text>
        <Text color="gray">tool: </Text>
        <Text color={statusColor}>{tool.toolName}</Text>{" "}
        <Text color={statusColor}>{tool.statusText}</Text>
      </Text>
      {tool.detailText ? <Text color="gray">{tool.detailText}</Text> : null}
      {tool.errorText ? <Text color="red">{tool.errorText}</Text> : null}
    </Box>
  );
}

function MessageParts({ message }: { message: PxiMessage }) {
  return (
    <Box flexDirection="column">
      {message.parts.map((part, index) => {
        if (part.type === "text") {
          return (
            <Markdown key={`${message.id}-text-${index}`}>{part.text}</Markdown>
          );
        }
        const tool = getToolProgressFromPart({ part });
        if (tool) {
          return <InlineToolProgress key={tool.toolCallId} tool={tool} />;
        }
        return null;
      })}
    </Box>
  );
}

function Transcript({ messages }: { messages: PxiMessage[] }) {
  if (messages.length === 0) {
    return (
      <Text color="gray">Ask a question to start a PXI server-agent chat.</Text>
    );
  }
  return (
    <Box flexDirection="column">
      {messages.map((message) => {
        const label = message.role === "user" ? "You" : "PXI";
        const color = message.role === "user" ? "cyan" : "green";
        return (
          <Box key={message.id} flexDirection="column" marginBottom={1}>
            <Text color={color} bold>
              {label}
            </Text>
            <MessageParts message={message} />
          </Box>
        );
      })}
    </Box>
  );
}

function InputPrompt({ draft, status }: { draft: string; status: PxiStatus }) {
  const cursor = status === "streaming" ? "" : "█";
  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1} marginTop={1}>
      <Text color="gray">
        Enter sends. Ctrl+J inserts a newline. Esc, Ctrl+D, or Ctrl+C exits.
      </Text>
      <Text>
        <Text color="cyan">{"> "}</Text>
        {draft}
        {cursor}
      </Text>
    </Box>
  );
}

export function ThinkingIndicator() {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((value) => (value + 1) % THINKING_FRAMES.length);
    }, 250);
    return () => clearInterval(interval);
  }, []);

  return <Text color="yellow">{THINKING_FRAMES[frameIndex]}</Text>;
}

export function PxiApp({ options, client, initialMessages = [] }: PxiAppProps) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<PxiMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<PxiStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatClient = useMemo(
    () => client ?? createPxiChatClient({ options }),
    [client, options]
  );

  const handleExit = () => {
    abortControllerRef.current?.abort();
    exit();
  };

  const submitDraft = () => {
    const text = draft.trim();
    if (!text || status === "streaming") {
      return;
    }
    const userMessage = createUserMessage({ text });
    const nextMessages = [...messages, userMessage];
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setDraft("");
    setError(null);
    setStatus("streaming");
    setMessages(nextMessages);
    void chatClient
      .sendMessage({
        messages: nextMessages,
        abortSignal: abortController.signal,
        onAssistantMessage: (assistantMessage) => {
          setMessages([...nextMessages, assistantMessage]);
        },
      })
      .then((assistantMessage) => {
        if (assistantMessage) {
          setMessages([...nextMessages, assistantMessage]);
        }
      })
      .catch((err: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        setStatus("idle");
      });
  };

  useInput((input, key) => {
    if (
      (key.ctrl && input === "c") ||
      (key.ctrl && input === "d") ||
      key.escape
    ) {
      handleExit();
      return;
    }
    if (status === "streaming") {
      return;
    }
    if (key.return) {
      submitDraft();
      return;
    }
    if (key.ctrl && input === "j") {
      setDraft((value) => `${value}\n`);
      return;
    }
    if (key.backspace || key.delete) {
      setDraft((value) => value.slice(0, -1));
      return;
    }
    if (input) {
      setDraft((value) => `${value}${input}`);
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>PXI</Text>
      <Text color="gray">
        endpoint: {options.config.endpoint} | model: {getModelLabel(options)} |
        session: {options.sessionId}
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Transcript messages={messages} />
      </Box>
      {error ? (
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      ) : null}
      {status === "streaming" ? <ThinkingIndicator /> : null}
      <InputPrompt draft={draft} status={status} />
    </Box>
  );
}
