import { Box, Text, useApp, useInput } from "ink";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { createPxiChatClient, createUserMessage } from "./client";
import { Markdown } from "./inkMarkdown";
import { getToolProgressFromPart, type ToolProgress } from "./toolProgress";
import type { PxiChatClient, PxiMessage, PxiRuntimeOptions } from "./types";

/**
 * The PXI terminal chat UI.
 *
 * This module renders the full Ink interface: the ASCII banner, the running
 * transcript of user/assistant turns (markdown and inline tool progress), a
 * thinking indicator while a reply streams, and the input prompt. {@link PxiApp}
 * owns the conversation state and drives the {@link PxiChatClient}.
 */

/** Whether the app is waiting on input (`idle`) or streaming a reply. */
type PxiStatus = "idle" | "streaming";

const PXI_BANNER = String.raw`
__/\\\\\\\\\\\\\____/\\\_______/\\\__/\\\\\\\\\\\_
 _\/\\\/////////\\\_\///\\\___/\\\/__\/////\\\///__
  _\/\\\_______\/\\\___\///\\\\\\/________\/\\\_____
   _\/\\\\\\\\\\\\\/______\//\\\\__________\/\\\_____
    _\/\\\/////////_________\/\\\\__________\/\\\_____
     _\/\\\__________________/\\\\\\_________\/\\\_____
      _\/\\\________________/\\\////\\\_______\/\\\_____
       _\/\\\______________/\\\/___\///\\\__/\\\\\\\\\\\_
        _\///______________\///_______\///__\///////////__
`;

const THINKING_FRAMES = [
  "PXI is thinking   ",
  "PXI is thinking.  ",
  "PXI is thinking.. ",
  "PXI is thinking...",
];
const KEYBOARD_PROTOCOL_RESPONSE_PATTERN = /^\[\?\d+u$/;

export type PxiAppProps = {
  options: PxiRuntimeOptions;
  client?: PxiChatClient;
  initialMessages?: PxiMessage[];
};

type BannerSegment = { text: string; raised: boolean };

// The 3D banner is drawn with two kinds of strokes: the `\` runs form the
// raised faces of the letters, while `/` and `_` are the recessed shading.
// Group each line into runs so the raised strokes can be colored distinctly.
function getBannerSegments(line: string): BannerSegment[] {
  const segments: BannerSegment[] = [];
  for (const char of line) {
    const raised = char === "\\";
    const last = segments[segments.length - 1];
    if (last && last.raised === raised) {
      last.text += char;
    } else {
      segments.push({ text: char, raised });
    }
  }
  return segments;
}

/** The PXI wordmark, colored so the raised letter faces stand out. */
function PxiBanner() {
  const lines = PXI_BANNER.replace(/^\n|\n$/g, "").split("\n");
  return (
    <Box flexDirection="column" marginY={1}>
      {lines.map((line, lineIndex) => (
        <Text key={lineIndex}>
          {getBannerSegments(line).map((segment, index) => (
            <Text
              key={index}
              // `blueBright` + bold reads clearly on both dark and light
              // terminal backgrounds, where plain `blue` washes out.
              color={segment.raised ? "blueBright" : "gray"}
              bold={segment.raised}
            >
              {segment.text}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  );
}

/** Format the active model for the status line (e.g. `ANTHROPIC/claude-opus-4-6`). */
function getModelLabel(options: PxiRuntimeOptions): string {
  if (options.modelSelection.providerType === "custom") {
    return `custom:${options.modelSelection.providerId}/${options.modelSelection.modelName}`;
  }
  return `${options.modelSelection.provider}/${options.modelSelection.modelName}`;
}

/** Render a single tool call inline in the transcript, coloring errors red. */
function InlineToolProgress({ tool }: { tool: ToolProgress }) {
  const statusColor = tool.state === "output-error" ? "red" : "yellow";
  return (
    <Box flexDirection="column" marginY={1} paddingLeft={2}>
      <Text>
        <Text dimColor>[tool]</Text>{" "}
        <Text color={statusColor}>{tool.toolName}</Text>{" "}
        <Text color={statusColor}>{tool.statusText}</Text>
      </Text>
      {tool.errorText ? <Text color="red">{tool.errorText}</Text> : null}
    </Box>
  );
}

/**
 * Render the ordered parts of one message: text parts as markdown, tool parts
 * as inline progress, skipping anything unrecognized.
 */
function MessageParts({
  message,
  phoenixBaseUrl,
}: {
  message: PxiMessage;
  phoenixBaseUrl?: string;
}) {
  return (
    <Box flexDirection="column">
      {message.parts.map((part, index) => {
        if (part.type === "text") {
          return (
            <Markdown
              key={`${message.id}-text-${index}`}
              phoenixBaseUrl={phoenixBaseUrl}
            >
              {part.text}
            </Markdown>
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

/**
 * Render the whole conversation as labeled, color-coded turns ("You" vs "PXI"),
 * or a placeholder when the conversation hasn't started.
 */
function Transcript({
  messages,
  phoenixBaseUrl,
}: {
  messages: PxiMessage[];
  phoenixBaseUrl?: string;
}) {
  if (messages.length === 0) {
    return <Text dimColor>Phoenix Intelligence.</Text>;
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
            <MessageParts message={message} phoenixBaseUrl={phoenixBaseUrl} />
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * The bordered input box showing the current draft, key hints, and a block
 * cursor (hidden while streaming, when typing is disabled).
 */
function InputPrompt({ draft, status }: { draft: string; status: PxiStatus }) {
  const cursor = status === "streaming" ? "" : "█";
  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1} marginTop={1}>
      <Text dimColor>
        Enter sends. Shift+Enter inserts a newline. Esc, Ctrl+D, or Ctrl+C
        exits.
      </Text>
      <Text>
        <Text color="cyan">{"> "}</Text>
        {draft}
        {cursor}
      </Text>
    </Box>
  );
}

function isKeyboardProtocolResponseInput({ input }: { input: string }) {
  return KEYBOARD_PROTOCOL_RESPONSE_PATTERN.test(input);
}

/** Animated "PXI is thinking…" indicator shown while a reply is streaming. */
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

/**
 * Root component for the PXI chat.
 *
 * Holds the conversation, draft input, streaming status, and any error, and
 * wires keyboard handling: Enter submits, Shift+Enter inserts a newline, and Esc /
 * Ctrl+C / Ctrl+D exit (aborting an in-flight request). On submit it appends the
 * user message, streams the assistant reply into the transcript as it arrives,
 * and ignores errors caused by the user aborting. The `client` and
 * `initialMessages` props exist mainly so tests can drive the UI with a fake
 * client and seeded history.
 */
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
    if (isKeyboardProtocolResponseInput({ input })) {
      return;
    }
    if (key.return && key.shift) {
      setDraft((value) => `${value}\n`);
      return;
    }
    if (key.return) {
      submitDraft();
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
      <PxiBanner />
      <Text dimColor>
        endpoint: {options.config.endpoint} | model: {getModelLabel(options)} |
        session: {options.sessionId}
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Transcript
          messages={messages}
          phoenixBaseUrl={options.config.endpoint}
        />
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
