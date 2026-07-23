import type { EventEmitter } from "node:events";
import { Box, Text, useApp, useInput, useStdin } from "ink";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { createPxiChatClient, createUserMessage } from "./client";
import {
  getSlashCommandName,
  matchingCommands,
  runSlashCommand,
  SLASH_COMMANDS,
} from "./commands";
import {
  deleteDraftTextAtCursor,
  deleteDraftTextBeforeCursor,
  EMPTY_DRAFT_EDITOR_STATE,
  insertDraftText,
  moveDraftCursor,
  moveDraftCursorToEnd,
  moveDraftCursorToStart,
  moveDraftCursorVertically,
  type DraftEditorState,
} from "./draftEditor";
import { Markdown } from "./inkMarkdown";
import { formatTokenUsageLine, getLatestAssistantUsage } from "./tokenUsage";
import {
  getToolProgressFromPart,
  type ToolProgress,
  type ToolProgressState,
} from "./toolProgress";
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
type DraftSegment = {
  text: string;
  isCommandSegment: boolean;
  isBold?: boolean;
};

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
const TOOL_SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
/** Tool states where the call is still in flight and shows a spinner. */
const RUNNING_TOOL_STATES: ReadonlySet<ToolProgressState> = new Set([
  "input-streaming",
  "input-available",
  "approval-responded",
]);
const ESCAPE_INPUT = "\x1B";
const BACKSPACE_INPUTS = new Set(["\b", "\x7F"]);
const FORWARD_DELETE_INPUTS = new Set([
  `${ESCAPE_INPUT}[3~`,
  `${ESCAPE_INPUT}[3$`,
  `${ESCAPE_INPUT}[3^`,
]);
const KITTY_BACKSPACE_INPUT_PATTERN =
  /^\x1B\[(?:8|127)(?:;\d+(?::[12])?(?:;[\d:]+)?)?u$/;
const KITTY_FORWARD_DELETE_INPUT_PATTERN = /^\x1B\[3;\d+:[12]~$/;
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

/** Animated braille spinner shown while a tool call is still in flight. */
function ToolSpinner() {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((value) => (value + 1) % TOOL_SPINNER_FRAMES.length);
    }, 250);
    return () => clearInterval(interval);
  }, []);

  return <Text color="yellow">{TOOL_SPINNER_FRAMES[frameIndex]}</Text>;
}

/**
 * The leading state glyph of a tool row: a spinner while the call is in
 * flight, then a settled glyph — `✓` success, `✗` failure (including a
 * non-zero exit code surfaced via `statusSuffix`), `?` awaiting approval,
 * `⊘` denied.
 */
function ToolStateIndicator({ tool }: { tool: ToolProgress }) {
  if (RUNNING_TOOL_STATES.has(tool.state)) {
    return <ToolSpinner />;
  }
  switch (tool.state) {
    case "output-available":
      return tool.statusSuffix ? (
        <Text color="red">✗</Text>
      ) : (
        <Text color="green">✓</Text>
      );
    case "output-error":
      return <Text color="red">✗</Text>;
    case "approval-requested":
      return <Text color="yellow">?</Text>;
    case "output-denied":
      return <Text dimColor>⊘</Text>;
    default:
      return <Text color="yellow">•</Text>;
  }
}

/**
 * Render a single tool call inline in the transcript: a state glyph, the
 * tool's icon and name, a dim one-line preview of what it is doing, then any
 * detail lines (e.g. the bash command) and error lines (e.g. stderr).
 * Completed "quiet" tools collapse to a single dim line.
 */
function InlineToolProgress({
  tool,
  marginTop,
  marginBottom,
}: {
  tool: ToolProgress;
  marginTop: number;
  marginBottom: number;
}) {
  if (tool.isQuiet && tool.state === "output-available") {
    return (
      <Box paddingLeft={2} marginTop={marginTop} marginBottom={marginBottom}>
        <Text wrap="truncate-end">
          <Text color="green">✓</Text>{" "}
          <Text dimColor>{tool.quietLabel ?? tool.toolName}</Text>
        </Text>
      </Box>
    );
  }
  const showStatusText =
    tool.state === "approval-requested" || tool.state === "output-denied";
  return (
    <Box
      flexDirection="column"
      paddingLeft={2}
      marginTop={marginTop}
      marginBottom={marginBottom}
    >
      <Text wrap="truncate-end">
        <ToolStateIndicator tool={tool} />{" "}
        <Text color="yellow">
          {tool.icon} {tool.toolName}
        </Text>
        {showStatusText ? <Text color="yellow"> {tool.statusText}</Text> : null}
        {tool.previewText ? <Text dimColor> · {tool.previewText}</Text> : null}
        {tool.statusSuffix ? (
          <Text color="red"> ({tool.statusSuffix})</Text>
        ) : null}
      </Text>
      {tool.detailLines.length > 0 ? (
        <Box flexDirection="column" paddingLeft={4}>
          {tool.detailLines.map((line, index) => (
            <Text key={index} dimColor wrap="truncate-end">
              {line}
            </Text>
          ))}
        </Box>
      ) : null}
      {tool.errorLines.length > 0 ? (
        <Box flexDirection="column" paddingLeft={4}>
          {tool.errorLines.map((line, index) => (
            <Text key={index} color="red" wrap="truncate-end">
              {line}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

/**
 * Render the ordered parts of one message: text parts as markdown, tool parts
 * as inline progress, skipping anything unrecognized. Consecutive tool calls
 * stack compactly — the blank line appears only at the boundary between a
 * tool block and its neighbors.
 */
function MessageParts({
  message,
  phoenixBaseUrl,
}: {
  message: PxiMessage;
  phoenixBaseUrl?: string;
}) {
  const toolProgressByPart = message.parts.map((part) =>
    getToolProgressFromPart({ part })
  );
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
        const tool = toolProgressByPart[index];
        if (tool) {
          return (
            <InlineToolProgress
              key={tool.toolCallId}
              tool={tool}
              marginTop={toolProgressByPart[index - 1] ? 0 : 1}
              marginBottom={toolProgressByPart[index + 1] ? 0 : 1}
            />
          );
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
function getHighlightedDraftSegments({
  draft,
}: {
  draft: string;
}): DraftSegment[] {
  if (!draft.startsWith("/")) {
    return [{ text: draft, isCommandSegment: false }];
  }
  const rest = draft.slice(1);
  const spaceIndex = rest.indexOf(" ");
  if (spaceIndex === -1) {
    return [
      { text: "/", isCommandSegment: true, isBold: false },
      { text: rest, isCommandSegment: true, isBold: true },
    ];
  }
  const cmdName = rest.slice(0, spaceIndex);
  const args = rest.slice(spaceIndex);
  return [
    { text: "/", isCommandSegment: true, isBold: false },
    { text: cmdName, isCommandSegment: true, isBold: true },
    { text: args, isCommandSegment: false },
  ];
}

function HighlightedDraftSegment({
  segment,
  isInverse = false,
}: {
  segment: DraftSegment;
  isInverse?: boolean;
}) {
  if (!segment.text) {
    return null;
  }
  if (segment.isCommandSegment) {
    return (
      <Text color="yellow" bold={segment.isBold} inverse={isInverse}>
        {segment.text}
      </Text>
    );
  }
  return <Text inverse={isInverse}>{segment.text}</Text>;
}

function HighlightedDraft({
  draft,
  cursorIndex,
  isCursorVisible,
}: {
  draft: string;
  cursorIndex: number;
  isCursorVisible: boolean;
}) {
  const segments = getHighlightedDraftSegments({ draft });
  const boundedCursorIndex = Math.min(Math.max(cursorIndex, 0), draft.length);
  let nextSegmentStartIndex = 0;
  let hasRenderedCursor = false;

  return (
    <Text>
      {segments.flatMap((segment, segmentIndex) => {
        const segmentStartIndex = nextSegmentStartIndex;
        const segmentEndIndex = segmentStartIndex + segment.text.length;
        nextSegmentStartIndex = segmentEndIndex;

        if (
          isCursorVisible &&
          !hasRenderedCursor &&
          boundedCursorIndex >= segmentStartIndex &&
          boundedCursorIndex < segmentEndIndex
        ) {
          hasRenderedCursor = true;
          const cursorOffset = boundedCursorIndex - segmentStartIndex;
          const beforeCursor = segment.text.slice(0, cursorOffset);
          const cursorText = segment.text.slice(cursorOffset, cursorOffset + 1);
          const isCursorOnNewline = cursorText === "\n";
          const afterCursor = segment.text.slice(cursorOffset + 1);
          return [
            <HighlightedDraftSegment
              key={`${segmentIndex}-before`}
              segment={{ ...segment, text: beforeCursor }}
            />,
            isCursorOnNewline ? (
              <Text key={`${segmentIndex}-cursor`}>{"█\n"}</Text>
            ) : (
              <HighlightedDraftSegment
                key={`${segmentIndex}-cursor`}
                segment={{ ...segment, text: cursorText }}
                isInverse
              />
            ),
            <HighlightedDraftSegment
              key={`${segmentIndex}-after`}
              segment={{ ...segment, text: afterCursor }}
            />,
          ];
        }

        return [
          <HighlightedDraftSegment
            key={`${segmentIndex}-whole`}
            segment={segment}
          />,
        ];
      })}
      {!hasRenderedCursor && isCursorVisible ? <Text>█</Text> : null}
    </Text>
  );
}

/** Render the prompt row with helper text below it. */
function InputPrompt({
  draft,
  status,
  usageLine,
  modelLabel,
}: {
  draft: DraftEditorState;
  status: PxiStatus;
  usageLine: string | null;
  modelLabel: string;
}) {
  const draftValue = draft.value;
  const cmdName = getSlashCommandName(draftValue);
  // Show matching commands while the user is still typing the command token
  // (no space yet means they haven't moved on to arguments).
  const showHints =
    cmdName !== null && !draftValue.includes(" ") && draftValue.length > 1;
  const hints = showHints ? matchingCommands(cmdName) : [];

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box
        borderStyle="single"
        borderLeft={false}
        borderRight={false}
        borderTop
        borderBottom
        borderColor="gray"
      >
        <Text>
          <Text color="cyan">{"❯ "}</Text>
          <HighlightedDraft
            draft={draftValue}
            cursorIndex={draft.cursorIndex}
            isCursorVisible={status !== "streaming"}
          />
        </Text>
      </Box>
      {/* Footer: helper text / command hints on the left, and the active model
          plus running token usage pinned to the bottom-right so the user can see
          which model is answering and how much of the context window is in play
          (mirrors the web UI's session usage line). */}
      <Box flexDirection="row" justifyContent="space-between">
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
            ↵ send · ⇧↵ newline · esc interrupt · /help · ctrl+c exit
          </Text>
        )}
        <Box flexShrink={0} marginLeft={2}>
          <Text>
            {usageLine ? <Text color="green">{usageLine}</Text> : null}
            {usageLine ? <Text dimColor>{" | "}</Text> : null}
            <Text dimColor>{modelLabel}</Text>
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

function isKeyboardProtocolResponseInput({ input }: { input: string }) {
  return KEYBOARD_PROTOCOL_RESPONSE_PATTERN.test(input);
}

function isBracketedPasteMarkerInput({ input }: { input: string }) {
  return input === `${ESCAPE_INPUT}[200~` || input === `${ESCAPE_INPUT}[201~`;
}

function isStrippedBracketedPasteMarkerInput({ input }: { input: string }) {
  return input === "[200~" || input === "[201~";
}

function isBackspaceInput({ input }: { input: string }) {
  return (
    BACKSPACE_INPUTS.has(input) || KITTY_BACKSPACE_INPUT_PATTERN.test(input)
  );
}

function isForwardDeleteInput({ input }: { input: string }) {
  return (
    FORWARD_DELETE_INPUTS.has(input) ||
    KITTY_FORWARD_DELETE_INPUT_PATTERN.test(input)
  );
}

function getDraftInputText({ input }: { input: string }) {
  return input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
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
  // ink v7 narrowed useStdin()'s return type to its public props, but the
  // context value still carries the internal raw-input emitter this app
  // relies on for backspace/forward-delete/paste-marker handling that
  // useInput does not surface.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- ink v7's public useStdin() type hides the internal_eventEmitter the runtime value still carries
  const { internal_eventEmitter: inputEventEmitter } = useStdin() as ReturnType<
    typeof useStdin
  > & { internal_eventEmitter: EventEmitter };
  const [messages, setMessages] = useState<PxiMessage[]>(initialMessages);
  const [draft, setDraft] = useState<DraftEditorState>(
    EMPTY_DRAFT_EDITOR_STATE
  );
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
    setDraft(EMPTY_DRAFT_EDITOR_STATE);
  };

  const submitDraft = () => {
    const text = draft.value.trim();
    if (!text || status === "streaming") {
      return;
    }

    // Intercept slash commands before sending to the server.
    if (text.startsWith("/")) {
      setDraft(EMPTY_DRAFT_EDITOR_STATE);
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
    setDraft(EMPTY_DRAFT_EDITOR_STATE);
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

  const bracketedPasteMarkerCountRef = useRef(0);
  const handleRawInput = (input: string) => {
    if (status === "streaming") {
      return;
    }
    if (isBracketedPasteMarkerInput({ input })) {
      bracketedPasteMarkerCountRef.current += 1;
      return;
    }
    if (isBackspaceInput({ input })) {
      setDraft((value) => deleteDraftTextBeforeCursor({ draft: value }));
      return;
    }
    if (isForwardDeleteInput({ input })) {
      setDraft((value) => deleteDraftTextAtCursor({ draft: value }));
    }
  };
  const rawInputHandlerRef = useRef(handleRawInput);
  rawInputHandlerRef.current = handleRawInput;

  useEffect(() => {
    const handleInputEvent = (input: string) => {
      rawInputHandlerRef.current(input);
    };
    inputEventEmitter.on("input", handleInputEvent);
    return () => {
      inputEventEmitter.removeListener("input", handleInputEvent);
    };
  }, [inputEventEmitter]);

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
    if (key.ctrl && input === "a") {
      setDraft((value) => moveDraftCursorToStart({ draft: value }));
      return;
    }
    if (key.ctrl && input === "e") {
      setDraft((value) => moveDraftCursorToEnd({ draft: value }));
      return;
    }
    if (key.return && key.shift) {
      setDraft((value) => insertDraftText({ draft: value, text: "\n" }));
      return;
    }
    if (key.return) {
      submitDraft();
      return;
    }
    if (key.leftArrow) {
      setDraft((value) => moveDraftCursor({ draft: value, offset: -1 }));
      return;
    }
    if (key.rightArrow) {
      setDraft((value) => moveDraftCursor({ draft: value, offset: 1 }));
      return;
    }
    if (key.upArrow) {
      setDraft((value) =>
        moveDraftCursorVertically({ draft: value, direction: -1 })
      );
      return;
    }
    if (key.downArrow) {
      setDraft((value) =>
        moveDraftCursorVertically({ draft: value, direction: 1 })
      );
      return;
    }
    if (key.home) {
      setDraft((value) => moveDraftCursorToStart({ draft: value }));
      return;
    }
    if (key.end) {
      setDraft((value) => moveDraftCursorToEnd({ draft: value }));
      return;
    }
    if (key.backspace || key.delete) {
      return;
    }
    if (
      isStrippedBracketedPasteMarkerInput({ input }) &&
      bracketedPasteMarkerCountRef.current > 0
    ) {
      bracketedPasteMarkerCountRef.current -= 1;
      return;
    }
    if (input) {
      const text = getDraftInputText({ input });
      if (text) {
        setDraft((value) => insertDraftText({ draft: value, text }));
      }
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
      <InputPrompt
        draft={draft}
        status={status}
        usageLine={formatTokenUsageLine(getLatestAssistantUsage(messages))}
        modelLabel={options.modelSelection.modelName}
      />
    </Box>
  );
}
