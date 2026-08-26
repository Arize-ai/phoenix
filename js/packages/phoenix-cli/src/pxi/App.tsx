import type { EventEmitter } from "node:events";
import { isToolUIPart } from "ai";
import { Box, Text, useApp, useInput, useStdin } from "ink";
import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  createPxiChatClient,
  createPxiSessionClient,
  createUserMessage,
  isSessionBusyError,
  isSessionMessagesStaleError,
  isSessionModelStaleError,
} from "./client";
import {
  getSlashCommandName,
  matchingCommands,
  runSlashCommand,
  SLASH_COMMANDS,
} from "./commands";
import { getCompactionSummary, isCompactionMessage } from "./compaction";
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
import {
  fetchRecommendedPxiModels,
  isSameModelSelection,
  resolveRestoredPxiModelSelection,
} from "./preflight";
import { formatTokenUsageLine, getLatestAssistantUsage } from "./tokenUsage";
import {
  getToolProgressFromPart,
  withInterruptedToolOutcome,
  type ToolProgress,
  type ToolProgressState,
} from "./toolProgress";
import type {
  ModelSelection,
  PhoenixAssistantMessageMetadata,
  PxiChatClient,
  PxiMessage,
  PxiRuntimeOptions,
  PxiSessionClient,
  PxiSession,
  PxiSessionSummary,
} from "./types";

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
type SessionPickerState = {
  status: "loading" | "ready" | "restoring" | "error";
  sessions: PxiSessionSummary[];
  query: string;
  selectedIndex: number;
  error: string | null;
};
type ModelPickerState = {
  status: "loading" | "ready" | "error";
  models: ModelSelection[];
  query: string;
  selectedIndex: number;
  error: string | null;
};
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
/**
 * Tool states that have not reached a terminal output. The CLI executes no
 * client tools and has no approval affordance, so it can never resolve one of
 * these itself: a pending call either belongs to the turn currently streaming
 * here, is still resolvable by the client that owns it (e.g. a browser
 * approval), or gets closed out as interrupted by the server on this CLI's
 * next send.
 */
const PENDING_TOOL_STATES: ReadonlySet<ToolProgressState> = new Set([
  ...RUNNING_TOOL_STATES,
  "approval-requested",
]);
const PENDING_ELSEWHERE_TOOL_STATUS_TEXT =
  "Pending in another client — sending a message here interrupts it";
/** Output the server records on a tool call the user interrupted. */
const INTERRUPTED_TOOL_OUTPUT_TEXT =
  "The tool call was interrupted before a result was produced.";
const ESCAPE_INPUT = "\x1B";
const BACKSPACE_INPUTS = new Set(["\b", "\x7F"]);
const FORWARD_DELETE_INPUTS = new Set([
  `${ESCAPE_INPUT}[3~`,
  `${ESCAPE_INPUT}[3$`,
  `${ESCAPE_INPUT}[3^`,
]);
const KITTY_BACKSPACE_INPUT_PATTERN =
  // oxlint-disable-next-line no-control-regex -- matches Kitty keyboard-protocol escape sequences
  /^\x1B\[(?:8|127)(?:;\d+(?::[12])?(?:;[\d:]+)?)?u$/;
// oxlint-disable-next-line no-control-regex -- matches Kitty keyboard-protocol escape sequences
const KITTY_FORWARD_DELETE_INPUT_PATTERN = /^\x1B\[3;\d+:[12]~$/;
const KEYBOARD_PROTOCOL_RESPONSE_PATTERN = /^\[\?\d+u$/;
/** Normal and busy cadences for synchronizing the active session. */
const SESSION_POLL_INTERVAL_MS = 10_000;
const SESSION_BUSY_POLL_INTERVAL_MS = 3000;
/** Cadence and cap for confirming the server persisted an interrupted turn. */
const INTERRUPT_RECONCILE_INTERVAL_MS = 500;
const INTERRUPT_RECONCILE_MAX_ATTEMPTS = 10;
const SESSION_BUSY_STATUS_TEXT =
  "Session is being used elsewhere, the chat will refresh when complete";
const SESSION_STALE_STATUS_TEXT =
  "Session was updated elsewhere, the chat has been refreshed";
/** Names the model so the switch is visible, not just that something changed. */
const getSessionModelStaleStatusText = ({
  modelSelection,
}: {
  modelSelection: ModelSelection;
}) =>
  `Model was changed elsewhere, this session is now on ${getModelLabel({ modelSelection })}`;
/**
 * Warns that a restored session's persisted model failed catalog validation.
 * The session stays on that model — swapping in a fallback locally would make
 * every send assert a model the server rejects as stale.
 */
const getPersistedModelWarningText = ({ message }: { message: string }) =>
  `Session model may be unavailable: ${message} Use /model to choose a different model.`;
const COMPACTING_STATUS_TEXT = "Compacting conversation";
const ALREADY_COMPACT_STATUS_TEXT =
  "Conversation is already compact. There are no older complete turns to compact.";
const COMPACT_WHILE_BUSY_ERROR_TEXT =
  "Session is being used elsewhere. Try again when the other turn completes.";
const COMPACT_DRAFT_SESSION_ERROR_TEXT =
  "There is no persisted conversation to compact.";
const COMPACTION_DIVIDER_TEXT = "── Conversation compacted ──";
const INTERRUPTED_RESPONSE_DIVIDER_TEXT = "── Response interrupted ──";
const EMPTY_INTERRUPTED_RESPONSE_DIVIDER_TEXT =
  "── Interrupted before a response was generated ──";

export type PxiAppProps = {
  options: PxiRuntimeOptions;
  client?: PxiChatClient;
  clientFactory?: (options: {
    options: PxiRuntimeOptions;
    agentSessionId: string;
  }) => PxiChatClient;
  modelLoader?: () => Promise<ModelSelection[]>;
  sessionClient?: PxiSessionClient;
  sessionModelResolver?: (model: ModelSelection) => Promise<ModelSelection>;
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

/** Format a model selection for display (e.g. `ANTHROPIC/claude-opus-4-8`). */
function getModelLabel({
  modelSelection,
}: {
  modelSelection: ModelSelection;
}): string {
  if (modelSelection.providerType === "custom") {
    return `custom:${modelSelection.providerId}/${modelSelection.modelName}`;
  }
  return `${modelSelection.provider}/${modelSelection.modelName}`;
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
 * `⊘` denied. Pending calls this CLI cannot resolve (restored from
 * persistence; the owning client may still submit them) show a warning
 * instead of a spinner.
 */
function ToolStateIndicator({
  tool,
  isPendingElsewhere,
}: {
  tool: ToolProgress;
  isPendingElsewhere?: boolean;
}) {
  if (isPendingElsewhere) {
    return <Text color="yellow">⚠</Text>;
  }
  if (tool.isInterrupted) {
    return <Text dimColor>⊘</Text>;
  }
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
  isPendingElsewhere,
  marginTop,
  marginBottom,
}: {
  tool: ToolProgress;
  isPendingElsewhere?: boolean;
  marginTop: number;
  marginBottom: number;
}) {
  if (
    tool.isQuiet &&
    tool.state === "output-available" &&
    !tool.isInterrupted
  ) {
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
    tool.isInterrupted ||
    tool.state === "approval-requested" ||
    tool.state === "output-denied";
  return (
    <Box
      flexDirection="column"
      paddingLeft={2}
      marginTop={marginTop}
      marginBottom={marginBottom}
    >
      <Text wrap="truncate-end">
        <ToolStateIndicator
          tool={tool}
          isPendingElsewhere={isPendingElsewhere}
        />{" "}
        <Text color="yellow">
          {tool.icon} {tool.toolName}
        </Text>
        {isPendingElsewhere ? (
          <Text color="yellow"> {PENDING_ELSEWHERE_TOOL_STATUS_TEXT}</Text>
        ) : showStatusText ? (
          <Text color="yellow" dimColor={tool.isInterrupted}>
            {" "}
            {tool.statusText}
          </Text>
        ) : null}
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
  hasLivePendingTools,
  phoenixBaseUrl,
}: {
  message: PxiMessage;
  /**
   * Whether this message's pending tool calls belong to a turn this CLI is
   * watching live (streaming here, or busy on another client). When false,
   * pending tool parts render as pending-elsewhere warnings instead of
   * spinners: the owning client may still submit them, and sending a message
   * from here interrupts them.
   */
  hasLivePendingTools: boolean;
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
              isPendingElsewhere={
                !hasLivePendingTools && PENDING_TOOL_STATES.has(tool.state)
              }
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
  liveMessageId,
  phoenixBaseUrl,
}: {
  messages: PxiMessage[];
  /**
   * The id of the one message whose pending tool calls a live turn (streaming
   * here, or busy on another client) is actively driving; null when the
   * session is idle. Pending tools outside that message aren't resolvable by
   * this CLI — though the client that owns them may still submit results — so
   * they render as pending-elsewhere warnings instead of spinners.
   */
  liveMessageId: string | null;
  phoenixBaseUrl?: string;
}) {
  if (messages.length === 0) {
    return <Text dimColor>Phoenix Intelligence.</Text>;
  }
  return (
    <Box flexDirection="column">
      {messages.map((message) => {
        if (isCompactionMessage({ message })) {
          // A compaction checkpoint is a persisted summary, not something the
          // user typed: render it as a labeled divider with the summary dimmed.
          return (
            <Box key={message.id} flexDirection="column" marginBottom={1}>
              <Text color="yellow" bold>
                {COMPACTION_DIVIDER_TEXT}
              </Text>
              <Text dimColor>{getCompactionSummary({ message })}</Text>
            </Box>
          );
        }
        const label = message.role === "user" ? "You" : "PXI";
        const color = message.role === "user" ? "cyan" : "green";
        const isInterrupted = isInterruptedMessage({ message });
        // A trailing tool line already carries its own bottom margin.
        const lastPart = message.parts.at(-1);
        const endsWithTool =
          lastPart !== undefined &&
          getToolProgressFromPart({ part: lastPart }) !== null;
        return (
          <Box key={message.id} flexDirection="column" marginBottom={1}>
            <Text color={color} bold>
              {label}
            </Text>
            <MessageParts
              message={message}
              hasLivePendingTools={message.id === liveMessageId}
              phoenixBaseUrl={phoenixBaseUrl}
            />
            {isInterrupted ? (
              <Box marginTop={endsWithTool ? 0 : 1}>
                <Text color="yellow" bold>
                  {message.parts.length > 0
                    ? INTERRUPTED_RESPONSE_DIVIDER_TEXT
                    : EMPTY_INTERRUPTED_RESPONSE_DIVIDER_TEXT}
                </Text>
              </Box>
            ) : null}
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

function getFilteredSessions({
  sessions,
  query,
}: {
  sessions: PxiSessionSummary[];
  query: string;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return sessions;
  return sessions.filter((session) =>
    session.title.toLowerCase().includes(normalizedQuery)
  );
}

function getSessionTitle({ title }: { title: string }) {
  return title.trim() || "Untitled session";
}

function getFilteredModels({
  models,
  query,
}: {
  models: ModelSelection[];
  query: string;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return models;
  return models.filter((modelSelection) =>
    getModelLabel({ modelSelection }).toLowerCase().includes(normalizedQuery)
  );
}

/** Model-selection mode rendered in place of the normal composer. */
function ModelPicker({ state }: { state: ModelPickerState }) {
  const filteredModels = getFilteredModels({
    models: state.models,
    query: state.query,
  });
  const selectedIndex = Math.min(
    state.selectedIndex,
    Math.max(filteredModels.length - 1, 0)
  );
  const firstVisibleIndex = Math.max(0, selectedIndex - 7);
  const visibleModels = filteredModels.slice(
    firstVisibleIndex,
    firstVisibleIndex + 8
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
      marginTop={1}
    >
      <Text bold>Recommended models</Text>
      {state.status === "loading" ? (
        <Text dimColor>Loading models…</Text>
      ) : null}
      {state.error ? <Text color="red">{state.error}</Text> : null}
      {state.status !== "loading" && state.models.length > 0 ? (
        <Text>
          <Text dimColor>Filter: </Text>
          {state.query}
          <Text color="cyan">█</Text>
        </Text>
      ) : null}
      {state.status !== "loading" && filteredModels.length === 0 ? (
        <Text dimColor>
          {state.models.length === 0
            ? "No recommended models are available."
            : "No models match this filter."}
        </Text>
      ) : null}
      {visibleModels.map((modelSelection, visibleIndex) => {
        const modelIndex = firstVisibleIndex + visibleIndex;
        const isSelected = modelIndex === selectedIndex;
        const label = getModelLabel({ modelSelection });
        return (
          <Text key={label} color={isSelected ? "cyan" : undefined}>
            {isSelected ? "› " : "  "}
            <Text bold={isSelected}>{label}</Text>
          </Text>
        );
      })}
      <Text dimColor>
        {state.status === "error"
          ? "esc close and retry"
          : "type to filter · ↑↓ navigate · enter select · esc cancel"}
      </Text>
    </Box>
  );
}

/** Session-selection mode rendered in place of the normal composer. */
function SessionPicker({ state }: { state: SessionPickerState }) {
  const filteredSessions = getFilteredSessions({
    sessions: state.sessions,
    query: state.query,
  });
  const selectedIndex = Math.min(
    state.selectedIndex,
    Math.max(filteredSessions.length - 1, 0)
  );
  const firstVisibleIndex = Math.max(0, selectedIndex - 7);
  const visibleSessions = filteredSessions.slice(
    firstVisibleIndex,
    firstVisibleIndex + 8
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
      marginTop={1}
    >
      <Text bold>Recent sessions</Text>
      {state.status === "loading" ? (
        <Text dimColor>Loading sessions…</Text>
      ) : null}
      {state.error ? <Text color="red">{state.error}</Text> : null}
      {state.status !== "loading" && state.sessions.length > 0 ? (
        <Text>
          <Text dimColor>Filter: </Text>
          {state.query}
          <Text color="cyan">█</Text>
        </Text>
      ) : null}
      {state.status !== "loading" && filteredSessions.length === 0 ? (
        <Text dimColor>
          {state.sessions.length === 0
            ? "No persisted sessions yet."
            : "No sessions match this filter."}
        </Text>
      ) : null}
      {visibleSessions.map((session, visibleIndex) => {
        const sessionIndex = firstVisibleIndex + visibleIndex;
        const isSelected = sessionIndex === selectedIndex;
        return (
          <Text key={session.id} color={isSelected ? "cyan" : undefined}>
            {isSelected ? "› " : "  "}
            <Text bold={isSelected}>
              {getSessionTitle({ title: session.title })}
            </Text>
            <Text dimColor>
              {"  "}
              {new Date(session.updatedAt).toLocaleString()}
            </Text>
          </Text>
        );
      })}
      <Text dimColor>
        {state.status === "restoring"
          ? "restoring session…"
          : "type to filter · ↑↓ navigate · enter restore · esc cancel"}
      </Text>
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

/**
 * Finalize one part of an interrupted message the way the server does: text
 * and reasoning are marked done, and a tool call still awaiting a result is
 * resolved as a neutral `output-available` carrying the interrupted outcome.
 */
function closeOutInterruptedPart({
  part,
}: {
  part: PxiMessagePart;
}): PxiMessagePart {
  if (part.type === "text" || part.type === "reasoning") {
    return { ...part, state: "done" };
  }
  if (part.type === "dynamic-tool") {
    if (!PENDING_TOOL_STATES.has(part.state)) {
      return part;
    }
    return {
      type: "dynamic-tool",
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      title: part.title,
      providerExecuted: part.providerExecuted,
      state: "output-available",
      input: part.input,
      output: INTERRUPTED_TOOL_OUTPUT_TEXT,
      callProviderMetadata: withInterruptedToolOutcome(
        part.callProviderMetadata
      ),
    };
  }
  if (isToolUIPart(part) && PENDING_TOOL_STATES.has(part.state)) {
    return {
      type: part.type,
      toolCallId: part.toolCallId,
      title: part.title,
      providerExecuted: part.providerExecuted,
      state: "output-available",
      input: part.input,
      output: INTERRUPTED_TOOL_OUTPUT_TEXT,
      callProviderMetadata: withInterruptedToolOutcome(
        part.callProviderMetadata
      ),
    };
  }
  return part;
}

/**
 * Close out an interrupted assistant message the way the server persists it,
 * so the transcript does not change when the poll swaps in the persisted copy.
 */
function markMessageInterrupted({
  message,
  sessionId,
}: {
  message: PxiMessage;
  sessionId: string;
}): PxiMessage {
  const phoenixMetadata = message.metadata?.phoenix;
  const interruptedMetadata: PhoenixAssistantMessageMetadata =
    phoenixMetadata?.type === "assistant"
      ? { ...phoenixMetadata, interrupted: true }
      : { type: "assistant", sessionId, interrupted: true };
  return {
    ...message,
    parts: message.parts.map((part) => closeOutInterruptedPart({ part })),
    metadata: { ...message.metadata, phoenix: interruptedMetadata },
  };
}

function isInterruptedMessage({ message }: { message: PxiMessage }) {
  const phoenixMetadata = message.metadata?.phoenix;
  return (
    message.role === "assistant" &&
    phoenixMetadata?.type === "assistant" &&
    phoenixMetadata.interrupted === true
  );
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
 * Spinner and status line for long-running session states — another client's
 * turn holding the server-side lock, or an in-flight compaction.
 */
function StatusSpinnerLine({ text }: { text: string }) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((value) => (value + 1) % TOOL_SPINNER_FRAMES.length);
    }, 250);
    return () => clearInterval(interval);
  }, []);

  return (
    <Text color="yellow">
      {TOOL_SPINNER_FRAMES[frameIndex]} {text}
    </Text>
  );
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
export function PxiApp({
  options,
  client,
  clientFactory,
  modelLoader,
  sessionClient,
  sessionModelResolver,
  initialMessages = [],
}: PxiAppProps) {
  const { exit } = useApp();
  // ink v7 narrowed useStdin()'s return type to its public props, but the
  // context value still carries the internal raw-input emitter this app
  // relies on for backspace/forward-delete/paste-marker handling that
  // useInput does not surface.
  const { internal_eventEmitter: inputEventEmitter } = useStdin() as ReturnType<
    typeof useStdin
  > & { internal_eventEmitter: EventEmitter };
  const [messages, setMessages] = useState<PxiMessage[]>(initialMessages);
  const [draft, setDraft] = useState<DraftEditorState>(
    EMPTY_DRAFT_EDITOR_STATE
  );
  const [status, setStatus] = useState<PxiStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  // Another client's turn holds the session's server-side lock (HTTP 409 on
  // send, or `isActive` on restore); plain sends are blocked while set.
  const [isSessionBusy, setIsSessionBusy] = useState(false);
  // A send was rejected as stale (another client appended to the session) and
  // the transcript was refreshed in place; shown until the next send.
  const [showStaleRefreshNotice, setShowStaleRefreshNotice] = useState(false);
  // A send or compaction was rejected because another client moved the session
  // to a different model. Tracked separately from the transcript notice so the
  // user is told what actually changed; shown until the next send.
  const [showModelStaleNotice, setShowModelStaleNotice] = useState(false);
  // A restored session's persisted model failed catalog validation (e.g. its
  // provider lost credentials). The model is kept anyway — the server record
  // is the source of truth — so this warning is what tells the user; shown
  // until the next send or model pick.
  const [modelValidationWarning, setModelValidationWarning] = useState<
    string | null
  >(null);
  // A compaction request is in flight; plain sends are blocked while set.
  const [isCompacting, setIsCompacting] = useState(false);
  // One-shot notice after a no-op compaction; shown until the next send.
  const [compactionNotice, setCompactionNotice] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<PxiSessionSummary | null>(
    null
  );
  const [activeModelSelection, setActiveModelSelection] =
    useState<ModelSelection>(options.modelSelection);
  const [isDraftTemporary, setIsDraftTemporary] = useState(false);
  const [modelPicker, setModelPicker] = useState<ModelPickerState | null>(null);
  const [sessionPicker, setSessionPicker] = useState<SessionPickerState | null>(
    null
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingAssistantMessageRef = useRef<PxiMessage | null>(null);
  /**
   * Confirmation that the server persisted the turn this client interrupted.
   * The next send awaits it so its `lastMessageId` check cannot race the
   * server's write of the interrupted message.
   */
  const interruptReconcileRef = useRef<Promise<void> | null>(null);
  const sendCountRef = useRef(0);
  const modelRequestIdRef = useRef(0);
  const sessionRequestIdRef = useRef(0);
  /**
   * Number of model writes awaiting acknowledgement. While non-zero the poll
   * leaves the model alone: it refetches server state that may predate the
   * user's pick, and applying it would revert the selection mid-flight.
   */
  const modelWriteCountRef = useRef(0);
  /**
   * Latest displayed selection, read by the poll so it can detect a remote
   * model change without taking `activeModelSelection` as an effect
   * dependency — that would restart the poll interval on every switch.
   */
  const activeModelSelectionRef = useRef(activeModelSelection);
  activeModelSelectionRef.current = activeModelSelection;
  /**
   * Last successfully fetched session list. Lets the picker open instantly
   * with the previous list while a background refresh fetches the latest —
   * the terminal equivalent of the web menu's store-and-network refetch.
   */
  const cachedSessionListRef = useRef<PxiSessionSummary[] | null>(null);
  /**
   * The persisted transcript's tail as of the last applied full fetch.
   * Polling probes the cheap sync state first and skips the full transcript
   * fetch while the tail hasn't moved, so idle sessions cost a tiny metadata
   * read instead of re-downloading every message.
   */
  const lastSyncedSessionStateRef = useRef<{
    sessionId: string;
    updatedAt: string;
    lastMessageId: string | null;
  } | null>(null);
  /** Records the applied transcript's tail after a full session fetch. */
  const recordSyncedSessionState = (session: PxiSession) => {
    lastSyncedSessionStateRef.current = {
      sessionId: session.id,
      updatedAt: session.updatedAt,
      lastMessageId: session.lastMessageId ?? null,
    };
  };
  const serverSessionClient = useMemo(
    () => sessionClient ?? createPxiSessionClient({ config: options.config }),
    [options.config, sessionClient]
  );
  const resolveSessionModel = useMemo(
    () =>
      sessionModelResolver ??
      ((model: ModelSelection) =>
        resolveRestoredPxiModelSelection({
          options,
          persistedModelSelection: model,
          onInvalidModel: ({ error }) => {
            // A /model pick in flight supersedes the model this resolve read;
            // its warning would describe a model the user already left.
            if (modelWriteCountRef.current > 0) {
              return;
            }
            setModelValidationWarning(
              getPersistedModelWarningText({ message: error.message })
            );
          },
        })),
    [options, sessionModelResolver]
  );

  // Keep the active session synchronized with turns completed by other
  // clients. Each tick fetches the cheap sync probe (isActive + transcript
  // tail) and only downloads the full transcript when the tail has moved
  // since the last applied fetch. Poll slowly during normal use and switch
  // to the existing faster cadence while another client holds the turn lock.
  // This client's own generation disables polling so its in-flight messages
  // cannot be replaced by an older persisted transcript.
  const activeSessionId = activeSession?.id ?? null;
  const isSessionPollingPaused = status === "streaming" || isCompacting;
  useEffect(() => {
    if (!activeSessionId || isSessionPollingPaused) {
      return undefined;
    }
    let isStale = false;
    const pollSession = () => {
      void serverSessionClient
        .getSessionSyncState({ sessionId: activeSessionId })
        .then(async (syncState) => {
          if (isStale) {
            return;
          }
          if (syncState.isActive) {
            setIsSessionBusy(true);
            return;
          }
          const lastSynced = lastSyncedSessionStateRef.current;
          const isTranscriptUnchanged =
            lastSynced != null &&
            lastSynced.sessionId === activeSessionId &&
            lastSynced.updatedAt === syncState.updatedAt &&
            lastSynced.lastMessageId === syncState.lastMessageId;
          if (isTranscriptUnchanged && !isSessionBusy) {
            return;
          }
          const session = await serverSessionClient.getSession({
            sessionId: activeSessionId,
          });
          if (isStale) {
            return;
          }
          if (session.isActive) {
            // Another client claimed the turn lock between the probe and the
            // full fetch; treat this tick as busy and resync on the next one.
            setIsSessionBusy(true);
            return;
          }
          recordSyncedSessionState(session);
          // Only re-resolve when the session actually moved to a different
          // model: resolving validates against the server's model catalog,
          // and doing that on every tick would put a network round trip on
          // the poll's steady state.
          const hasModelChanged = !isSameModelSelection(
            session.model,
            activeModelSelectionRef.current
          );
          const restoredModel = hasModelChanged
            ? await resolveSessionModel(session.model)
            : activeModelSelectionRef.current;
          if (isStale) {
            return;
          }
          setActiveSession(session);
          if (hasModelChanged && modelWriteCountRef.current === 0) {
            setActiveModelSelection(restoredModel);
          }
          setMessages(session.messages);
          setIsSessionBusy(false);
        })
        .catch(() => {
          // Transient failure: wait for the next poll tick.
        });
    };
    const intervalId = setInterval(
      pollSession,
      isSessionBusy ? SESSION_BUSY_POLL_INTERVAL_MS : SESSION_POLL_INTERVAL_MS
    );
    return () => {
      isStale = true;
      clearInterval(intervalId);
    };
  }, [
    activeSessionId,
    isSessionPollingPaused,
    isSessionBusy,
    resolveSessionModel,
    serverSessionClient,
  ]);

  const handleExit = () => {
    abortControllerRef.current?.abort();
    exit();
  };

  /** Poll until the persisted transcript's tail is the interrupted message. */
  const waitForInterruptedTurnPersisted = async ({
    sessionId,
    messageId,
  }: {
    sessionId: string;
    messageId: string;
  }): Promise<boolean> => {
    for (
      let attempt = 0;
      attempt < INTERRUPT_RECONCILE_MAX_ATTEMPTS;
      attempt += 1
    ) {
      if (attempt > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, INTERRUPT_RECONCILE_INTERVAL_MS)
        );
      }
      try {
        const syncState = await serverSessionClient.getSessionSyncState({
          sessionId,
        });
        if (!syncState.isActive && syncState.lastMessageId === messageId) {
          return true;
        }
      } catch {
        // Transient failure: try again on the next tick.
      }
    }
    return false;
  };

  /**
   * After an interrupt, swap in the server's copy of the turn as soon as it
   * is persisted instead of waiting for the idle poll. Skipped once a new
   * send starts: the send only needs the persistence confirmation.
   */
  const reconcileInterruptedTurn = ({
    sessionId,
    messageId,
  }: {
    sessionId: string;
    messageId: string;
  }) => {
    const requestId = sessionRequestIdRef.current;
    const sendCount = sendCountRef.current;
    const isSuperseded = () =>
      sessionRequestIdRef.current !== requestId ||
      sendCountRef.current !== sendCount;
    const reconcile = waitForInterruptedTurnPersisted({ sessionId, messageId })
      .then(async (isPersisted) => {
        if (!isPersisted || isSuperseded()) {
          return;
        }
        const session = await serverSessionClient.getSession({ sessionId });
        if (isSuperseded()) {
          return;
        }
        recordSyncedSessionState(session);
        setActiveSession(session);
        setMessages(session.messages);
      })
      .catch(() => {
        // The idle poll reconciles on its next tick.
      })
      .finally(() => {
        if (interruptReconcileRef.current === reconcile) {
          interruptReconcileRef.current = null;
        }
      });
    interruptReconcileRef.current = reconcile;
  };

  const interruptStream = () => {
    if (status !== "streaming") {
      return;
    }
    abortControllerRef.current?.abort();
    const assistantMessage = streamingAssistantMessageRef.current;
    if (assistantMessage && activeSession) {
      reconcileInterruptedTurn({
        sessionId: activeSession.id,
        messageId: assistantMessage.id,
      });
    }
    if (assistantMessage) {
      const interruptedMessage = markMessageInterrupted({
        message: assistantMessage,
        // Only a draft session has no id; the marker is local until the poll
        // replaces it with the persisted message.
        sessionId: activeSession?.id ?? "",
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

  const startNewSession = ({ temporary }: { temporary: boolean }) => {
    modelRequestIdRef.current += 1;
    sessionRequestIdRef.current += 1;
    interruptReconcileRef.current = null;
    setActiveSession(null);
    lastSyncedSessionStateRef.current = null;
    setActiveModelSelection(options.modelSelection);
    setIsDraftTemporary(temporary);
    setIsSessionBusy(false);
    setShowStaleRefreshNotice(false);
    setShowModelStaleNotice(false);
    setCompactionNotice(null);
    setModelValidationWarning(null);
    setModelPicker(null);
    setSessionPicker(null);
    setMessages([]);
    setError(null);
    setDraft(EMPTY_DRAFT_EDITOR_STATE);
  };

  const closeSessionPicker = () => {
    sessionRequestIdRef.current += 1;
    interruptReconcileRef.current = null;
    setSessionPicker(null);
  };

  const openSessionPicker = () => {
    modelRequestIdRef.current += 1;
    setModelPicker(null);
    const requestId = sessionRequestIdRef.current + 1;
    sessionRequestIdRef.current = requestId;
    setDraft(EMPTY_DRAFT_EDITOR_STATE);
    setError(null);
    // Open instantly with the last fetched list (when there is one) while a
    // background refresh fetches sessions created elsewhere in the meantime.
    const cachedSessions = cachedSessionListRef.current;
    setSessionPicker({
      status: cachedSessions ? "ready" : "loading",
      sessions: cachedSessions ?? [],
      query: "",
      selectedIndex: 0,
      error: null,
    });
    void serverSessionClient
      .listSessions()
      .then((sessions) => {
        cachedSessionListRef.current = sessions;
        if (sessionRequestIdRef.current !== requestId) return;
        setSessionPicker((current) => {
          if (!current) return null;
          // The user may already be filtering or navigating the cached list;
          // keep their selection on the same session after the refresh.
          const selectedSession = getFilteredSessions({
            sessions: current.sessions,
            query: current.query,
          })[current.selectedIndex];
          const refreshedFilteredSessions = getFilteredSessions({
            sessions,
            query: current.query,
          });
          const refreshedSelectedIndex = selectedSession
            ? refreshedFilteredSessions.findIndex(
                (session) => session.id === selectedSession.id
              )
            : -1;
          return {
            ...current,
            status: "ready",
            sessions,
            selectedIndex:
              refreshedSelectedIndex === -1
                ? Math.min(
                    current.selectedIndex,
                    Math.max(refreshedFilteredSessions.length - 1, 0)
                  )
                : refreshedSelectedIndex,
            error: null,
          };
        });
      })
      .catch((sessionError: unknown) => {
        if (sessionRequestIdRef.current !== requestId) return;
        // With a cached list on screen the stale data is still usable, so a
        // failed background refresh is ignored.
        if (cachedSessions) return;
        setSessionPicker({
          status: "error",
          sessions: [],
          query: "",
          selectedIndex: 0,
          error:
            sessionError instanceof Error
              ? sessionError.message
              : String(sessionError),
        });
      });
  };

  const closeModelPicker = () => {
    modelRequestIdRef.current += 1;
    setModelPicker(null);
  };

  const openModelPicker = () => {
    sessionRequestIdRef.current += 1;
    interruptReconcileRef.current = null;
    setSessionPicker(null);
    const requestId = modelRequestIdRef.current + 1;
    modelRequestIdRef.current = requestId;
    setDraft(EMPTY_DRAFT_EDITOR_STATE);
    setError(null);
    setModelPicker({
      status: "loading",
      models: [],
      query: "",
      selectedIndex: 0,
      error: null,
    });
    const loadModels =
      modelLoader ??
      (() => fetchRecommendedPxiModels({ config: options.config }));
    void loadModels()
      .then((models) => {
        if (modelRequestIdRef.current !== requestId) return;
        setModelPicker({
          status: "ready",
          models,
          query: "",
          selectedIndex: 0,
          error: null,
        });
      })
      .catch((modelError: unknown) => {
        if (modelRequestIdRef.current !== requestId) return;
        setModelPicker({
          status: "error",
          models: [],
          query: "",
          selectedIndex: 0,
          error:
            modelError instanceof Error
              ? modelError.message
              : String(modelError),
        });
      });
  };

  const selectModel = () => {
    if (!modelPicker || modelPicker.status !== "ready") return;
    const filteredModels = getFilteredModels({
      models: modelPicker.models,
      query: modelPicker.query,
    });
    const selectedModel = filteredModels[modelPicker.selectedIndex];
    if (!selectedModel) return;
    const previousModel = activeModelSelection;
    setActiveModelSelection(selectedModel);
    setModelPicker(null);
    setError(null);
    // The pick replaces whatever model the warning was about.
    setModelValidationWarning(null);
    // A draft has no server record yet; its selection travels with the
    // createSession call that starts the session.
    const persistedSessionId = activeSession?.id;
    if (!persistedSessionId) return;
    // Held across the write so the poll cannot apply a server read that
    // predates it and revert the pick.
    modelWriteCountRef.current += 1;
    const requestId = sessionRequestIdRef.current;
    void serverSessionClient
      .patchSessionModel({
        sessionId: persistedSessionId,
        model: selectedModel,
      })
      .then((model) => {
        if (sessionRequestIdRef.current !== requestId) return;
        setActiveModelSelection(model);
      })
      .catch((err) => {
        if (sessionRequestIdRef.current !== requestId) return;
        setActiveModelSelection(previousModel);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        modelWriteCountRef.current -= 1;
      });
  };

  const restoreSelectedSession = () => {
    if (!sessionPicker || sessionPicker.status !== "ready") return;
    const filteredSessions = getFilteredSessions({
      sessions: sessionPicker.sessions,
      query: sessionPicker.query,
    });
    const selectedSession = filteredSessions[sessionPicker.selectedIndex];
    if (!selectedSession) return;
    const requestId = sessionRequestIdRef.current + 1;
    sessionRequestIdRef.current = requestId;
    setSessionPicker((current) =>
      current ? { ...current, status: "restoring", error: null } : null
    );
    void serverSessionClient
      .getSession({ sessionId: selectedSession.id })
      .then(async (session) => {
        if (sessionRequestIdRef.current !== requestId) return;
        // Cleared before the resolve so a warning it raises about this
        // session's model survives, while one from a previous session does
        // not.
        setModelValidationWarning(null);
        // Explicit --provider/--model express an intent to move the session
        // onto that model, so restoring writes it rather than shadowing the
        // persisted value locally. Applied once here, not on every poll —
        // and skipped when the session is already on that model, which would
        // make the write a no-op round trip that still bumps the session's
        // updated_at and reorders the session list.
        const shouldWriteExplicitModel =
          options.hasExplicitModelSelection &&
          !isSameModelSelection(session.model, options.modelSelection);
        const restoredModel = shouldWriteExplicitModel
          ? await serverSessionClient.patchSessionModel({
              sessionId: session.id,
              model: options.modelSelection,
            })
          : await resolveSessionModel(session.model);
        if (sessionRequestIdRef.current !== requestId) return;
        recordSyncedSessionState(session);
        setActiveSession(session);
        setActiveModelSelection(restoredModel);
        setIsDraftTemporary(session.isTemporary);
        // Another client's turn may already hold the restored session's lock;
        // enter the busy state so the poll refreshes the transcript when it
        // completes.
        setIsSessionBusy(session.isActive === true);
        setShowStaleRefreshNotice(false);
        setShowModelStaleNotice(false);
        setCompactionNotice(null);
        setMessages(session.messages);
        setError(null);
        setDraft(EMPTY_DRAFT_EDITOR_STATE);
        setSessionPicker(null);
      })
      .catch((sessionError: unknown) => {
        if (sessionRequestIdRef.current !== requestId) return;
        setSessionPicker((current) =>
          current
            ? {
                ...current,
                status: "error",
                error:
                  sessionError instanceof Error
                    ? sessionError.message
                    : String(sessionError),
              }
            : null
        );
      });
  };

  /**
   * Compact the persisted conversation into a checkpoint summary. Mirrors the
   * web UI's `/compact`: rejected while the session is busy elsewhere, shows a
   * one-shot notice when there is nothing to compact, and sends `pendingText`
   * as a follow-up message once the compaction lands.
   */
  const compactSession = (pendingText?: string) => {
    setCompactionNotice(null);
    const restorePendingText = () => {
      if (pendingText) {
        setDraft((currentDraft) =>
          currentDraft.value
            ? currentDraft
            : { value: pendingText, cursorIndex: pendingText.length }
        );
      }
    };
    if (!activeSession) {
      restorePendingText();
      setError(COMPACT_DRAFT_SESSION_ERROR_TEXT);
      return;
    }
    if (isCompacting) {
      restorePendingText();
      return;
    }
    if (isSessionBusy) {
      restorePendingText();
      setError(COMPACT_WHILE_BUSY_ERROR_TEXT);
      return;
    }
    const compactionSessionId = activeSession.id;
    // A session switch (/new, restore) mid-compaction supersedes this request.
    const requestId = sessionRequestIdRef.current;
    const baseMessages = messages;
    setError(null);
    setIsCompacting(true);
    void serverSessionClient
      .compactSession({
        sessionId: compactionSessionId,
        model: activeModelSelection,
      })
      .then((result) => {
        if (sessionRequestIdRef.current !== requestId) return;
        const checkpoint = result.compactionMessage;
        const nextMessages =
          checkpoint &&
          !baseMessages.some((message) => message.id === checkpoint.id)
            ? [...baseMessages, checkpoint]
            : baseMessages;
        setMessages(nextMessages);
        if (!result.compacted) {
          setCompactionNotice(ALREADY_COMPACT_STATUS_TEXT);
        }
        if (pendingText) {
          sendUserText({ text: pendingText, baseMessages: nextMessages });
        }
      })
      .catch((compactError: unknown) => {
        if (sessionRequestIdRef.current !== requestId) return;
        restorePendingText();
        if (isSessionBusyError({ error: compactError })) {
          // Another client's turn holds the session lock (HTTP 409): enter
          // the busy state; the poll refreshes the transcript once the other
          // turn completes.
          setIsSessionBusy(true);
          return;
        }
        if (isSessionModelStaleError({ error: compactError })) {
          // Another client moved the session to a different model (HTTP 409).
          // No summary was generated; refresh so the header and the next
          // request agree with the server, and say what changed.
          const staleSessionId = activeSession?.id;
          if (!staleSessionId) {
            return;
          }
          void serverSessionClient
            .getSession({ sessionId: staleSessionId })
            .then(async (session) => {
              if (sessionRequestIdRef.current !== requestId) return;
              const restoredModel = await resolveSessionModel(session.model);
              if (sessionRequestIdRef.current !== requestId) return;
              // A 409 racing the user's own /model write must not flip the
              // header back to the old model or announce the reverse of what
              // the user did: the in-flight write re-applies their pick and
              // the poll reconciles any residue.
              if (modelWriteCountRef.current > 0) return;
              setActiveModelSelection(restoredModel);
              setShowModelStaleNotice(true);
            })
            .catch(() => {
              // Refresh failed; the next compaction hits the same rejection.
            });
          return;
        }
        setError(
          compactError instanceof Error
            ? compactError.message
            : String(compactError)
        );
      })
      .finally(() => {
        setIsCompacting(false);
      });
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
        startNewSession,
        openModelPicker,
        openSessionPicker,
        compactSession,
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

    // Plain sends are blocked while another client's turn holds the session
    // lock or a compaction is in flight; keep the draft editable so nothing
    // typed is lost.
    if (isSessionBusy || isCompacting) {
      return;
    }

    setDraft(EMPTY_DRAFT_EDITOR_STATE);
    sendUserText({ text, baseMessages: messages });
  };

  /** Append a user message to `baseMessages` and stream the reply. */
  const sendUserText = ({
    text,
    baseMessages,
  }: {
    text: string;
    baseMessages: PxiMessage[];
  }) => {
    const userMessage = createUserMessage({ text });
    const nextMessages = [...baseMessages, userMessage];
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    streamingAssistantMessageRef.current = null;
    sendCountRef.current += 1;
    setError(null);
    setShowStaleRefreshNotice(false);
    setShowModelStaleNotice(false);
    setCompactionNotice(null);
    setModelValidationWarning(null);
    setStatus("streaming");
    setMessages(nextMessages);
    void (async () => {
      let resolvedClient = client;
      const activeOptions = {
        ...options,
        modelSelection: activeModelSelection,
      };
      const createClient = clientFactory ?? createPxiChatClient;
      if (!activeSession && (sessionClient || !resolvedClient)) {
        const session = await serverSessionClient.createSession({
          temporary: isDraftTemporary,
          model: activeModelSelection,
        });
        setActiveSession(session);
        if (!resolvedClient) {
          resolvedClient = createClient({
            options: activeOptions,
            agentSessionId: session.id,
          });
        }
      } else if (!resolvedClient && activeSession) {
        resolvedClient = createClient({
          options: activeOptions,
          agentSessionId: activeSession.id,
        });
      }
      if (!resolvedClient) {
        throw new Error("Could not initialize the PXI chat client.");
      }
      await interruptReconcileRef.current;
      return resolvedClient.sendMessage({
        messages: nextMessages,
        abortSignal: abortController.signal,
        onAssistantMessage: (assistantMessage) => {
          streamingAssistantMessageRef.current = assistantMessage;
          setMessages([...nextMessages, assistantMessage]);
        },
        onSessionTitle: (title) => {
          setActiveSession((currentSession) =>
            currentSession ? { ...currentSession, title } : currentSession
          );
        },
      });
    })()
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
        if (isSessionBusyError({ error: err })) {
          // Another client's turn holds the session lock (HTTP 409). Withdraw
          // the optimistic user message back into the composer (unless the
          // user already typed something new) and enter the busy state; the
          // poll refreshes the transcript once the other turn completes.
          setMessages((currentMessages) =>
            currentMessages.filter((message) => message.id !== userMessage.id)
          );
          setDraft((currentDraft) =>
            currentDraft.value
              ? currentDraft
              : { value: text, cursorIndex: text.length }
          );
          setIsSessionBusy(true);
          return;
        }
        const isModelStale = isSessionModelStaleError({ error: err });
        if (isModelStale || isSessionMessagesStaleError({ error: err })) {
          // The send was rejected because this client's view of the session is
          // out of date (HTTP 409): either another client appended to the
          // transcript, or moved the session to a different model. Withdraw
          // the optimistic user message back into the composer and refetch the
          // session; if a turn is already running elsewhere, hand off to the
          // busy poll instead of the one-shot notice.
          setMessages((currentMessages) =>
            currentMessages.filter((message) => message.id !== userMessage.id)
          );
          setDraft((currentDraft) =>
            currentDraft.value
              ? currentDraft
              : { value: text, cursorIndex: text.length }
          );
          const staleSessionId = activeSession?.id;
          if (!staleSessionId) {
            return;
          }
          const requestId = sessionRequestIdRef.current;
          void serverSessionClient
            .getSession({ sessionId: staleSessionId })
            .then(async (session) => {
              // A session switch or /new superseded this refresh.
              if (sessionRequestIdRef.current !== requestId) return;
              recordSyncedSessionState(session);
              const restoredModel = await resolveSessionModel(session.model);
              if (sessionRequestIdRef.current !== requestId) return;
              // A 409 racing the user's own /model write must not flip the
              // header back to the old model or announce the reverse of what
              // the user did: the in-flight write re-applies their pick and
              // the poll reconciles any residue.
              const hasModelWriteInFlight = modelWriteCountRef.current > 0;
              setActiveSession(session);
              if (!hasModelWriteInFlight) {
                setActiveModelSelection(restoredModel);
              }
              setMessages(session.messages);
              if (isModelStale) {
                if (!hasModelWriteInFlight) {
                  setShowModelStaleNotice(true);
                }
              } else {
                setShowStaleRefreshNotice(true);
              }
              if (session.isActive === true) {
                setIsSessionBusy(true);
              }
            })
            .catch(() => {
              // Refresh failed; the draft is intact and the next send will
              // hit the stale rejection again.
            });
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
      if (modelPicker) {
        setModelPicker((current) =>
          current
            ? {
                ...current,
                query: current.query.slice(0, -1),
                selectedIndex: 0,
              }
            : null
        );
        return;
      }
      if (sessionPicker) {
        setSessionPicker((current) =>
          current
            ? {
                ...current,
                query: current.query.slice(0, -1),
                selectedIndex: 0,
              }
            : null
        );
        return;
      }
      setDraft((value) => deleteDraftTextBeforeCursor({ draft: value }));
      return;
    }
    if (isForwardDeleteInput({ input })) {
      if (modelPicker || sessionPicker) return;
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
    if ((key.ctrl && input === "c") || (key.ctrl && input === "d")) {
      handleExit();
      return;
    }
    if (modelPicker) {
      if (key.escape) {
        closeModelPicker();
        return;
      }
      if (modelPicker.status !== "ready") {
        return;
      }
      const filteredModels = getFilteredModels({
        models: modelPicker.models,
        query: modelPicker.query,
      });
      if (key.upArrow) {
        setModelPicker((current) =>
          current
            ? {
                ...current,
                selectedIndex: Math.max(0, current.selectedIndex - 1),
              }
            : null
        );
        return;
      }
      if (key.downArrow) {
        setModelPicker((current) =>
          current
            ? {
                ...current,
                selectedIndex: Math.min(
                  Math.max(filteredModels.length - 1, 0),
                  current.selectedIndex + 1
                ),
              }
            : null
        );
        return;
      }
      if (key.return) {
        selectModel();
        return;
      }
      if (
        key.backspace ||
        key.delete ||
        isStrippedBracketedPasteMarkerInput({ input }) ||
        isKeyboardProtocolResponseInput({ input })
      ) {
        return;
      }
      if (input) {
        const text = getDraftInputText({ input }).replace(/\n/g, "");
        if (text) {
          setModelPicker((current) =>
            current
              ? {
                  ...current,
                  query: current.query + text,
                  selectedIndex: 0,
                  error: null,
                  status: "ready",
                }
              : null
          );
        }
      }
      return;
    }
    if (sessionPicker) {
      if (key.escape) {
        closeSessionPicker();
        return;
      }
      if (
        sessionPicker.status === "loading" ||
        sessionPicker.status === "restoring"
      ) {
        return;
      }
      const filteredSessions = getFilteredSessions({
        sessions: sessionPicker.sessions,
        query: sessionPicker.query,
      });
      if (key.upArrow) {
        setSessionPicker((current) =>
          current
            ? {
                ...current,
                selectedIndex: Math.max(0, current.selectedIndex - 1),
              }
            : null
        );
        return;
      }
      if (key.downArrow) {
        setSessionPicker((current) =>
          current
            ? {
                ...current,
                selectedIndex: Math.min(
                  Math.max(filteredSessions.length - 1, 0),
                  current.selectedIndex + 1
                ),
              }
            : null
        );
        return;
      }
      if (key.return) {
        restoreSelectedSession();
        return;
      }
      if (
        key.backspace ||
        key.delete ||
        isStrippedBracketedPasteMarkerInput({ input }) ||
        isKeyboardProtocolResponseInput({ input })
      ) {
        return;
      }
      if (input) {
        const text = getDraftInputText({ input }).replace(/\n/g, "");
        if (text) {
          setSessionPicker((current) =>
            current
              ? {
                  ...current,
                  query: current.query + text,
                  selectedIndex: 0,
                  error: null,
                  status: "ready",
                }
              : null
          );
        }
      }
      return;
    }
    if (key.escape) {
      interruptStream();
      return;
    }
    if (status === "streaming") {
      return;
    }
    if (isKeyboardProtocolResponseInput({ input })) {
      return;
    }
    if (key.tab) {
      const commandName = getSlashCommandName(draft.value);
      const suggestion =
        commandName !== null &&
        draft.value.length > 1 &&
        !draft.value.includes(" ")
          ? matchingCommands(commandName)[0]
          : undefined;
      if (suggestion) {
        const completedCommand = `/${suggestion.name}`;
        setDraft({
          value: completedCommand,
          cursorIndex: completedCommand.length,
        });
      }
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

  // The one-shot yellow notices share a single line; precedence mirrors the
  // web app's: compaction result, then model moved elsewhere, then transcript
  // refreshed, then the persisted-model validation warning.
  const noticeText =
    compactionNotice ??
    (showModelStaleNotice
      ? getSessionModelStaleStatusText({
          modelSelection: activeModelSelection,
        })
      : showStaleRefreshNotice
        ? SESSION_STALE_STATUS_TEXT
        : modelValidationWarning);

  return (
    <Box flexDirection="column" paddingX={1}>
      <PxiBanner />
      <Text dimColor>
        endpoint: {options.config.endpoint} | model:{" "}
        {getModelLabel({ modelSelection: activeModelSelection })} | session:{" "}
        {activeSession
          ? getSessionTitle({ title: activeSession.title })
          : isDraftTemporary
            ? "new temporary session"
            : "new session"}
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Transcript
          messages={messages}
          liveMessageId={
            status === "streaming" || isSessionBusy
              ? (messages.at(-1)?.id ?? null)
              : null
          }
          phoenixBaseUrl={options.config.endpoint}
        />
      </Box>
      {error ? (
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      ) : null}
      {status === "streaming" ? (
        <ThinkingIndicator />
      ) : isCompacting ? (
        <StatusSpinnerLine text={COMPACTING_STATUS_TEXT} />
      ) : isSessionBusy ? (
        <StatusSpinnerLine text={SESSION_BUSY_STATUS_TEXT} />
      ) : noticeText ? (
        <Text color="yellow">{noticeText}</Text>
      ) : null}
      {modelPicker ? (
        <ModelPicker state={modelPicker} />
      ) : sessionPicker ? (
        <SessionPicker state={sessionPicker} />
      ) : (
        <InputPrompt
          draft={draft}
          status={status}
          usageLine={formatTokenUsageLine(getLatestAssistantUsage(messages))}
          modelLabel={activeModelSelection.modelName}
        />
      )}
    </Box>
  );
}
