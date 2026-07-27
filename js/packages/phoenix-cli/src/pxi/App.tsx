import type { EventEmitter } from "node:events";
import { Box, Text, useApp, useInput, useStdin } from "ink";
import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  createPxiChatClient,
  createPxiSessionClient,
  createUserMessage,
  getPxiClientId,
} from "./client";
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
import { PxiBusyError } from "./errors";
import { Markdown } from "./inkMarkdown";
import { fetchRecommendedPxiModels } from "./preflight";
import { formatTokenUsageLine, getLatestAssistantUsage } from "./tokenUsage";
import {
  getToolProgressFromPart,
  type ToolProgress,
  type ToolProgressState,
} from "./toolProgress";
import type {
  ModelSelection,
  PxiChatClient,
  PxiMessage,
  PxiRuntimeOptions,
  PxiSessionClient,
  PxiSessionState,
  PxiSessionSummary,
  PxiTurnStarted,
} from "./types";

/**
 * The PXI terminal chat UI.
 *
 * This module renders the full Ink interface: the ASCII banner, the running
 * transcript of user/assistant turns (markdown and inline tool progress), a
 * thinking indicator while a reply streams, and the input prompt. {@link PxiApp}
 * owns the conversation state and drives the {@link PxiChatClient}.
 */

/** Whether the app is accepting input or following an active local/remote turn. */
type PxiStatus =
  | "idle"
  | "streaming"
  | "remote-streaming"
  | "remote-awaiting-tool"
  | "degraded";

/** Statuses driven by another client's activity on the attached session. */
const REMOTE_BUSY_STATUSES: ReadonlySet<PxiStatus> = new Set([
  "remote-streaming",
  "remote-awaiting-tool",
  "degraded",
]);

function getSessionStatus({
  sessionState,
}: {
  sessionState: PxiSessionState | null;
}): Exclude<PxiStatus, "streaming"> {
  if (!sessionState || sessionState.state === "idle") {
    return "idle";
  }
  if (sessionState.state === "awaiting_client_tool") {
    return "remote-awaiting-tool";
  }
  // A session held by another Phoenix instance cannot stream to this process;
  // a session on this instance can, even when its replay buffer overflowed.
  return sessionState.ownedByThisInstance ? "remote-streaming" : "degraded";
}

/**
 * The yellow status line under the transcript while another client owns the
 * session, describing what is actually happening: streaming elsewhere, paused
 * on a client tool, mutating (compaction/edit), replay overflow on this
 * instance, or busy on a different Phoenix instance entirely.
 */
function getBusyStatusText({
  status,
  sessionState,
}: {
  status: PxiStatus;
  sessionState: PxiSessionState | null;
}): string | null {
  switch (status) {
    case "remote-awaiting-tool":
      return "Waiting for a tool call to run in another client…";
    case "degraded":
      return "PXI is busy on another Phoenix instance; live output is unavailable.";
    case "remote-streaming":
      if (sessionState?.state === "mutating") {
        return "The session is being updated in another client…";
      }
      if (sessionState?.streamAvailable === false) {
        return "PXI is responding to another client; this turn is too long to replay, so output may be incomplete.";
      }
      return "Following PXI response from another client…";
    default:
      return null;
  }
}

/** The composer footer hint for the current status. */
function getHelperText({
  status,
  sessionState,
}: {
  status: PxiStatus;
  sessionState: PxiSessionState | null;
}): string {
  switch (status) {
    case "remote-awaiting-tool":
      return "waiting for a tool in another client · esc stop · /new /sessions · ctrl+c exit";
    case "degraded":
      return "session busy on another Phoenix instance · esc stop · /new /sessions · ctrl+c exit";
    case "remote-streaming":
      // Stopping a mutation is not supported (the server rejects it), so
      // don't advertise esc while the session is being updated elsewhere.
      return sessionState?.state === "mutating"
        ? "session updating in another client · /new /sessions · ctrl+c exit"
        : "following another client · esc stop · /new /sessions · ctrl+c exit";
    default:
      return "↵ send · ⇧↵ newline · esc interrupt · /help · ctrl+c exit";
  }
}

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
  clientFactory?: (options: {
    options: PxiRuntimeOptions;
    agentSessionId: string;
  }) => PxiChatClient;
  modelLoader?: () => Promise<ModelSelection[]>;
  sessionClient?: PxiSessionClient;
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
  sessionState,
  usageLine,
  modelLabel,
}: {
  draft: DraftEditorState;
  status: PxiStatus;
  sessionState: PxiSessionState | null;
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
  const helperText = getHelperText({ status, sessionState });

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
            // The composer stays usable while another client owns the session
            // (slash commands still work); only a local in-flight send hides
            // the cursor.
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
          <Text dimColor>{helperText}</Text>
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

type RemoteTurnBaseline = {
  turnId: string;
  messages: PxiMessage[];
};

function buildRemoteTurnBaseline({
  messages,
  turn,
  assistantMessageId,
}: {
  messages: PxiMessage[];
  turn: PxiTurnStarted;
  assistantMessageId?: string | null;
}): PxiMessage[] {
  const submittedMessageIndex = messages.findIndex(
    (message) => message.id === turn.message.id
  );
  if (submittedMessageIndex >= 0) {
    return [...messages.slice(0, submittedMessageIndex), turn.message];
  }
  const trailingMessage = messages.at(-1);
  const hasReplayedAssistant =
    trailingMessage?.role === "assistant" &&
    Boolean(assistantMessageId) &&
    trailingMessage.id === assistantMessageId;
  const persistedBaseline = hasReplayedAssistant
    ? messages.slice(0, -1)
    : messages;
  return [...persistedBaseline, turn.message];
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
export function PxiApp({
  options,
  client,
  clientFactory,
  modelLoader,
  sessionClient,
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
  // Render-facing mirror of `sessionStateRef` so busy-status copy re-renders
  // on every server state chunk, not only when the coarse status changes.
  const [remoteSessionState, setRemoteSessionState] =
    useState<PxiSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const statusRef = useRef<PxiStatus>(status);
  const messagesRef = useRef<PxiMessage[]>(messages);
  const sessionStateRef = useRef<PxiSessionState | null>(null);
  const remoteTurnBaselineRef = useRef<RemoteTurnBaseline | null>(null);
  const pendingLocalTurnBaselineRef = useRef<PxiMessage[] | null>(null);
  const isStoppingRef = useRef(false);
  const modelRequestIdRef = useRef(0);
  const sessionRequestIdRef = useRef(0);
  statusRef.current = status;
  messagesRef.current = messages;
  const serverSessionClient = useMemo(
    () => sessionClient ?? createPxiSessionClient({ config: options.config }),
    [options.config, sessionClient]
  );

  useEffect(() => {
    const sessionId = activeSession?.id;
    const subscribe = serverSessionClient.subscribeToSessionEvents;
    sessionStateRef.current = null;
    setRemoteSessionState(null);
    remoteTurnBaselineRef.current = null;
    if (!sessionId || !subscribe) {
      return;
    }

    const eventAbortController = new AbortController();
    let isCurrentSession = true;
    const refreshDegradedTranscript = () => {
      void serverSessionClient
        .getSession({ sessionId })
        .then((session) => {
          if (!isCurrentSession || sessionStateRef.current?.state !== "idle") {
            return;
          }
          setActiveSession(session);
          messagesRef.current = session.messages;
          setMessages(session.messages);
        })
        .catch((sessionError: unknown) => {
          if (!isCurrentSession) {
            return;
          }
          setError(
            sessionError instanceof Error
              ? sessionError.message
              : String(sessionError)
          );
        });
    };

    void subscribe({
      sessionId,
      abortSignal: eventAbortController.signal,
      onSessionState: (sessionState) => {
        const previousSessionState = sessionStateRef.current;
        sessionStateRef.current = sessionState;
        setRemoteSessionState(sessionState);
        const isSessionBusy = sessionState.state !== "idle";
        const isActiveLocalTurn =
          sessionState.originClientId === getPxiClientId() &&
          statusRef.current === "streaming";
        if (isSessionBusy && !isActiveLocalTurn) {
          const nextStatus = getSessionStatus({ sessionState });
          statusRef.current = nextStatus;
          setStatus(nextStatus);
          return;
        }
        if (!isSessionBusy) {
          const previousStatus = statusRef.current;
          if (REMOTE_BUSY_STATUSES.has(previousStatus)) {
            statusRef.current = "idle";
            setStatus("idle");
          }
          remoteTurnBaselineRef.current = null;
          // Live output may have been missed when the session ran on another
          // instance, or when this instance's replay buffer overflowed (a
          // late subscriber gets no replay then); recover from the persisted
          // transcript.
          if (
            previousStatus === "degraded" ||
            previousSessionState?.streamAvailable === false
          ) {
            refreshDegradedTranscript();
          }
        }
      },
      onTurnStarted: (turn) => {
        const sessionState = sessionStateRef.current;
        const isActiveLocalTurn =
          sessionState?.originClientId === getPxiClientId() &&
          statusRef.current === "streaming";
        const previousBaseline = remoteTurnBaselineRef.current;
        const baseline =
          previousBaseline && previousBaseline.turnId === turn.turnId
            ? previousBaseline.messages
            : buildRemoteTurnBaseline({
                messages:
                  pendingLocalTurnBaselineRef.current ?? messagesRef.current,
                turn,
                assistantMessageId: sessionState?.assistantMessageId,
              });
        remoteTurnBaselineRef.current = {
          turnId: turn.turnId,
          messages: baseline,
        };
        if (isActiveLocalTurn) {
          return;
        }
        messagesRef.current = baseline;
        setMessages(baseline);
      },
      onAssistantMessage: ({ turnId, message }) => {
        const sessionState = sessionStateRef.current;
        const isActiveLocalTurn =
          sessionState?.originClientId === getPxiClientId() &&
          statusRef.current === "streaming";
        const baseline = remoteTurnBaselineRef.current;
        if (isActiveLocalTurn || baseline?.turnId !== turnId) {
          return;
        }
        const nextMessages = [...baseline.messages, message];
        messagesRef.current = nextMessages;
        setMessages(nextMessages);
      },
      onSessionTitle: (title) => {
        setActiveSession((currentSession) =>
          currentSession ? { ...currentSession, title } : currentSession
        );
      },
      onError: (sessionError) => {
        if (!eventAbortController.signal.aborted) {
          setError(
            sessionError instanceof Error
              ? sessionError.message
              : String(sessionError)
          );
        }
      },
    }).catch((sessionError: unknown) => {
      if (!eventAbortController.signal.aborted) {
        setError(
          sessionError instanceof Error
            ? sessionError.message
            : String(sessionError)
        );
      }
    });

    return () => {
      isCurrentSession = false;
      eventAbortController.abort();
    };
  }, [activeSession?.id, serverSessionClient]);

  const handleExit = () => {
    abortControllerRef.current?.abort();
    exit();
  };

  const interruptLocally = () => {
    abortControllerRef.current?.abort();
    const assistantMessage = streamingAssistantMessageRef.current;
    if (assistantMessage) {
      const interruptedMessage = markMessageInterrupted({
        message: assistantMessage,
      });
      streamingAssistantMessageRef.current = interruptedMessage;
      setMessages((currentMessages) => {
        const lastMessage = currentMessages.at(-1);
        const nextMessages =
          lastMessage?.id === assistantMessage.id
            ? [...currentMessages.slice(0, -1), interruptedMessage]
            : [...currentMessages, interruptedMessage];
        messagesRef.current = nextMessages;
        return nextMessages;
      });
    }
    const nextStatus = getSessionStatus({
      sessionState: sessionStateRef.current,
    });
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  };

  const interruptStream = () => {
    if (statusRef.current === "idle" || isStoppingRef.current) {
      return;
    }
    const sessionId = activeSession?.id;
    const stop = serverSessionClient.stopSession;
    if (!sessionId || !stop) {
      if (statusRef.current === "streaming") {
        interruptLocally();
      }
      return;
    }
    isStoppingRef.current = true;
    const interruptedStatus = statusRef.current;
    void stop({
      sessionId,
      turnId: sessionStateRef.current?.turnId ?? undefined,
    })
      .catch((stopError: unknown) => {
        setError(
          stopError instanceof Error ? stopError.message : String(stopError)
        );
        if (interruptedStatus === "streaming") {
          interruptLocally();
        }
      })
      .finally(() => {
        isStoppingRef.current = false;
      });
  };

  const startNewSession = ({ temporary }: { temporary: boolean }) => {
    modelRequestIdRef.current += 1;
    sessionRequestIdRef.current += 1;
    setActiveSession(null);
    setIsDraftTemporary(temporary);
    setModelPicker(null);
    setSessionPicker(null);
    statusRef.current = "idle";
    setStatus("idle");
    sessionStateRef.current = null;
    setRemoteSessionState(null);
    remoteTurnBaselineRef.current = null;
    messagesRef.current = [];
    setMessages([]);
    setError(null);
    setDraft(EMPTY_DRAFT_EDITOR_STATE);
  };

  const closeSessionPicker = () => {
    sessionRequestIdRef.current += 1;
    setSessionPicker(null);
  };

  const openSessionPicker = () => {
    modelRequestIdRef.current += 1;
    setModelPicker(null);
    const requestId = sessionRequestIdRef.current + 1;
    sessionRequestIdRef.current = requestId;
    setDraft(EMPTY_DRAFT_EDITOR_STATE);
    setError(null);
    setSessionPicker({
      status: "loading",
      sessions: [],
      query: "",
      selectedIndex: 0,
      error: null,
    });
    void serverSessionClient
      .listSessions()
      .then((sessions) => {
        if (sessionRequestIdRef.current !== requestId) return;
        setSessionPicker({
          status: "ready",
          sessions,
          query: "",
          selectedIndex: 0,
          error: null,
        });
      })
      .catch((sessionError: unknown) => {
        if (sessionRequestIdRef.current !== requestId) return;
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
    setActiveModelSelection(selectedModel);
    setModelPicker(null);
    setError(null);
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
      .then((session) => {
        if (sessionRequestIdRef.current !== requestId) return;
        // Reset any remote-busy status carried over from the previous
        // session; the new session's subscription re-derives it.
        statusRef.current = "idle";
        setStatus("idle");
        sessionStateRef.current = null;
        setRemoteSessionState(null);
        remoteTurnBaselineRef.current = null;
        setActiveSession(session);
        setIsDraftTemporary(session.isTemporary);
        messagesRef.current = session.messages;
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

  const submitDraft = () => {
    const text = draft.value.trim();
    if (!text || statusRef.current === "streaming") {
      return;
    }

    // Intercept slash commands before sending to the server. These stay
    // available while another client owns the session, so a remote turn never
    // locks the user out of /new, /sessions, etc.
    if (text.startsWith("/")) {
      setDraft(EMPTY_DRAFT_EDITOR_STATE);
      const result = runSlashCommand(text, {
        startNewSession,
        openModelPicker,
        openSessionPicker,
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

    // Plain sends are rejected while the session is busy elsewhere; keep the
    // draft so nothing typed is lost.
    if (statusRef.current !== "idle") {
      setError(
        "The session is busy in another client. Press esc to stop it, or use /new or /sessions to switch."
      );
      return;
    }

    const userMessage = createUserMessage({ text });
    const nextMessages = [...messages, userMessage];
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    streamingAssistantMessageRef.current = null;
    setDraft(EMPTY_DRAFT_EDITOR_STATE);
    setError(null);
    pendingLocalTurnBaselineRef.current = messages;
    statusRef.current = "streaming";
    setStatus("streaming");
    messagesRef.current = nextMessages;
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
      return resolvedClient.sendMessage({
        messages: nextMessages,
        abortSignal: abortController.signal,
        onAssistantMessage: (assistantMessage) => {
          streamingAssistantMessageRef.current = assistantMessage;
          const streamedMessages = [...nextMessages, assistantMessage];
          messagesRef.current = streamedMessages;
          setMessages(streamedMessages);
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
          const finalMessages = [...nextMessages, assistantMessage];
          messagesRef.current = finalMessages;
          setMessages(finalMessages);
        }
      })
      .catch((err: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }
        if (err instanceof PxiBusyError) {
          const observedSessionState = sessionStateRef.current;
          const nextStatus =
            observedSessionState?.turnId === err.turnId
              ? getSessionStatus({ sessionState: observedSessionState })
              : err.ownedByThisInstance
                ? "remote-streaming"
                : "degraded";
          statusRef.current = nextStatus;
          setStatus(nextStatus);
          if (!remoteTurnBaselineRef.current) {
            messagesRef.current = messages;
            setMessages(messages);
          }
          // The send was rejected, so give the user their message back to
          // retry once the session is free (unless they've typed since).
          setDraft((currentDraft) =>
            currentDraft.value
              ? currentDraft
              : { value: text, cursorIndex: text.length }
          );
        }
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        pendingLocalTurnBaselineRef.current = null;
        if (statusRef.current === "streaming") {
          const nextStatus = getSessionStatus({
            sessionState: sessionStateRef.current,
          });
          statusRef.current = nextStatus;
          setStatus(nextStatus);
        }
      });
  };

  const bracketedPasteMarkerCountRef = useRef(0);
  const handleRawInput = (input: string) => {
    // Only a local in-flight send blocks the composer; while another client
    // owns the session the user can still draft slash commands.
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
    // Only a local in-flight send blocks the composer; slash commands remain
    // available while another client owns the session.
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

  const busyStatusText = getBusyStatusText({
    status,
    sessionState: remoteSessionState,
  });

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
          phoenixBaseUrl={options.config.endpoint}
        />
      </Box>
      {error ? (
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      ) : null}
      {status === "streaming" ? <ThinkingIndicator /> : null}
      {busyStatusText ? <Text color="yellow">{busyStatusText}</Text> : null}
      {modelPicker ? (
        <ModelPicker state={modelPicker} />
      ) : sessionPicker ? (
        <SessionPicker state={sessionPicker} />
      ) : (
        <InputPrompt
          draft={draft}
          status={status}
          sessionState={remoteSessionState}
          usageLine={formatTokenUsageLine(getLatestAssistantUsage(messages))}
          modelLabel={activeModelSelection.modelName}
        />
      )}
    </Box>
  );
}
