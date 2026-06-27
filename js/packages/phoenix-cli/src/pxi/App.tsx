import { Box, Text, useApp, useInput } from "ink";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { createPxiChatClient, createUserMessage } from "./client";
import {
  getSlashCommandName,
  matchingCommands,
  runSlashCommand,
  SLASH_COMMANDS,
} from "./commands";
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
type PxiMessagePart = PxiMessage["parts"][number];

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
const INTERRUPTED_MESSAGE_TEXT = "\n\n[Interrupted by user before completion.]";

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

/** Format the active model for the status line (e.g. `ANTHROPIC/claude-opus-4-8`). */
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
 * Render the draft text with slash-command syntax highlighting.
 *
 * When the draft starts with `/`, the command name is colored yellow and the
 * arguments follow in default color. Everything else renders as plain text.
 */
function HighlightedDraft({ draft }: { draft: string }) {
  if (!draft.startsWith("/")) {
    return <Text>{draft}</Text>;
  }
  const rest = draft.slice(1);
  const spaceIndex = rest.indexOf(" ");
  if (spaceIndex === -1) {
    // Still typing the command name — color the whole token
    return (
      <Text>
        <Text color="yellow">/</Text>
        <Text color="yellow" bold>
          {rest}
        </Text>
      </Text>
    );
  }
  const cmdName = rest.slice(0, spaceIndex);
  const args = rest.slice(spaceIndex);
  return (
    <Text>
      <Text color="yellow">/</Text>
      <Text color="yellow" bold>
        {cmdName}
      </Text>
      <Text>{args}</Text>
    </Text>
  );
}

/** Render the prompt row with helper text below it. */
function InputPrompt({ draft, status }: { draft: string; status: PxiStatus }) {
  const cursor = status === "streaming" ? "" : "█";
  const cmdName = getSlashCommandName(draft);
  // Show matching commands while the user is still typing the command token
  // (no space yet means they haven't moved on to arguments).
  const showHints =
    cmdName !== null && !draft.includes(" ") && draft.length > 1;
  const hints = showHints ? matchingCommands(cmdName) : [];

  return (
    <Box flexDirection="column" marginTop={1} gap={1}>
      <Box
        borderStyle="single"
        borderLeft={false}
        borderRight={false}
        borderTop
        borderBottom
        borderColor="gray"
      >
        <Text>
          <Text color="cyan">{"> "}</Text>
          <HighlightedDraft draft={draft} />
          {cursor}
        </Text>
      </Box>
      {hints.length > 0 ? (
        <Box flexDirection="column">
          {hints.map((cmd) => (
            <Text key={cmd.name}>
              <Text color="yellow">{"  /"}</Text>
              <Text color="yellow" bold>
                {cmd.name}
              </Text>
              <Text dimColor>
                {"  "}
                {cmd.description}
              </Text>
            </Text>
          ))}
        </Box>
      ) : (
        <Text dimColor>
          Enter sends. Shift+Enter inserts a newline. Esc interrupts. Type /help
          for commands. Ctrl+D or Ctrl+C exits.
        </Text>
      )}
    </Box>
  );
}

function isKeyboardProtocolResponseInput({ input }: { input: string }) {
  return KEYBOARD_PROTOCOL_RESPONSE_PATTERN.test(input);
}

function getCompletedInterruptedPart({
  part,
}: {
  part: PxiMessagePart;
}): PxiMessagePart | null {
  if (part.type === "text" || part.type === "reasoning") {
    return { ...part, state: "done" };
  }
  if (part.type === "dynamic-tool") {
    return part.state === "output-available" ||
      part.state === "output-error" ||
      part.state === "output-denied"
      ? part
      : null;
  }
  if (
    "state" in part &&
    typeof part.type === "string" &&
    part.type.startsWith("tool-")
  ) {
    return part.state === "output-available" ||
      part.state === "output-error" ||
      part.state === "output-denied"
      ? part
      : null;
  }
  return part;
}

function markMessageInterrupted({
  message,
}: {
  message: PxiMessage;
}): PxiMessage {
  return {
    ...message,
    parts: [
      ...message.parts.flatMap((part) => {
        const completedPart = getCompletedInterruptedPart({ part });
        return completedPart ? [completedPart] : [];
      }),
      { type: "text", text: INTERRUPTED_MESSAGE_TEXT, state: "done" },
    ],
  };
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
 * wires keyboard handling: Enter submits, Shift+Enter inserts a newline, Esc
 * interrupts an in-flight request, and Ctrl+C / Ctrl+D exit. On submit it appends the
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
  const streamingAssistantMessageRef = useRef<PxiMessage | null>(null);
  const chatClient = useMemo(
    () => client ?? createPxiChatClient({ options }),
    [client, options]
  );

  const handleExit = () => {
    abortControllerRef.current?.abort();
    exit();
  };

  const interruptStream = () => {
    if (status !== "streaming") {
      return;
    }
    abortControllerRef.current?.abort();
    const assistantMessage = streamingAssistantMessageRef.current;
    if (assistantMessage) {
      const interruptedMessage = markMessageInterrupted({
        message: assistantMessage,
      });
      streamingAssistantMessageRef.current = interruptedMessage;
      setMessages((currentMessages) => {
        const lastMessage = currentMessages.at(-1);
        if (lastMessage?.id === assistantMessage.id) {
          return [...currentMessages.slice(0, -1), interruptedMessage];
        }
        return [...currentMessages, interruptedMessage];
      });
    }
    setStatus("idle");
  };

  const clearMessages = () => {
    setMessages([]);
    setError(null);
    setDraft("");
  };

  const submitDraft = () => {
    const text = draft.trim();
    if (!text || status === "streaming") {
      return;
    }

    // Intercept slash commands before sending to the server.
    if (text.startsWith("/")) {
      setDraft("");
      const result = runSlashCommand(text, {
        clearMessages,
        exit: handleExit,
      });
      if (result.type === "help") {
        const helpLines = SLASH_COMMANDS.map(
          (c) => `  \`/${c.name}\` — ${c.description}`
        ).join("\n");
        const helpMessage = createUserMessage({ text });
        const helpReply: PxiMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          parts: [
            {
              type: "text",
              text: `Available commands:\n${helpLines}`,
              state: "done",
            },
          ],
        };
        setMessages((m) => [...m, helpMessage, helpReply]);
      } else if (result.type === "unknown") {
        setError(
          `Unknown command: /${result.name}. Type /help to see available commands.`
        );
      }
      return;
    }

    const userMessage = createUserMessage({ text });
    const nextMessages = [...messages, userMessage];
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    streamingAssistantMessageRef.current = null;
    setDraft("");
    setError(null);
    setStatus("streaming");
    setMessages(nextMessages);
    void chatClient
      .sendMessage({
        messages: nextMessages,
        abortSignal: abortController.signal,
        onAssistantMessage: (assistantMessage) => {
          streamingAssistantMessageRef.current = assistantMessage;
          setMessages([...nextMessages, assistantMessage]);
        },
      })
      .then((assistantMessage) => {
        if (abortController.signal.aborted) {
          return;
        }
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
    if (key.escape) {
      interruptStream();
      return;
    }
    if ((key.ctrl && input === "c") || (key.ctrl && input === "d")) {
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
