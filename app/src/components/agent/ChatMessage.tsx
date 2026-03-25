import { css } from "@emotion/react";
import { getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { useMemo, useState } from "react";

import {
  getBashToolCommandDisplayResult,
  getBashToolInput,
} from "@phoenix/agent/tools/bash";
import { Badge, Flex, Icon, Icons } from "@phoenix/components";
import { MarkdownBlock } from "@phoenix/components/markdown";

const userMessageCSS = css`
  align-self: flex-end;
  background-color: var(--global-color-primary-700);
  color: var(--global-color-gray-50);
  border-radius: var(--global-rounding-large) var(--global-rounding-large) 0
    var(--global-rounding-large);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  max-width: 75%;
  word-wrap: break-word;
`;

const assistantMessageCSS = css`
  align-self: flex-start;
  max-width: 100%;
  width: 100%;
`;

const toolPartCSS = css`
  margin-top: var(--global-dimension-size-150);
  border: 1px solid var(--global-color-gray-300);
  border-radius: var(--global-rounding-medium);
  background: var(--global-color-gray-100);
  overflow: hidden;

  &:has(+ :not(.tool-part)) {
    margin-bottom: var(--global-dimension-size-150);
  }

  summary {
    cursor: pointer;
    list-style: none;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
    background: var(--global-color-gray-75);
    border-radius: var(--global-rounding-medium);
    transition: background 150ms ease;

    &:hover {
      background: var(--global-color-gray-200);
    }

    &:focus-visible {
      outline: 2px solid var(--global-color-primary);
      outline-offset: -2px;
    }
  }

  summary::-webkit-details-marker {
    display: none;
  }

  &[open] summary {
    border-radius: var(--global-rounding-medium) var(--global-rounding-medium) 0 0;
  }

  /* Rotate chevron when open */
  &[open] .tool-part__chevron {
    transform: rotate(0deg);
  }

  pre {
    margin: 0;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-s);
    font-family: var(--ac-global-font-family-code);
    background: var(--global-color-gray-50);
    border-top: 1px solid var(--global-color-gray-200);
  }

  .tool-part__summary {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    color: var(--global-text-color-700);
    font-size: var(--global-font-size-xs);
    min-width: 0;
  }

  .tool-part__title {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tool-part__preview {
    font-weight: 400;
    font-family: var(--ac-global-font-family-code);
    color: var(--global-text-color-500);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .tool-part__status {
    margin-left: auto;
    flex-shrink: 0;
    white-space: nowrap;
    color: var(--global-text-color-500);
  }

  .tool-part__status[data-tone="error"] {
    color: var(--global-color-danger);
  }

  .tool-part__chevron {
    font-size: 12px;
    color: var(--global-text-color-500);
    transition: transform 150ms ease;
    transform: rotate(-90deg);
  }

  .tool-part__label {
    display: block;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150) 0;
    color: var(--global-text-color-500);
    font-size: var(--global-font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
`;

const toolPoolCSS = css`
  width: 100%;
  margin-top: var(--global-dimension-size-150);
  border: 1px solid var(--global-color-gray-300);
  border-radius: var(--global-rounding-medium);
  background: var(--global-color-gray-100);
  overflow: hidden;

  &:has(+ :not(.tool-pool)) {
    margin-bottom: var(--global-dimension-size-150);
  }

  .tool-pool__header {
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-50);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
    background: var(--global-color-gray-75);
    user-select: none;
    border-radius: var(--global-rounding-medium);
    transition: background 150ms ease;

    &:hover {
      background: var(--global-color-gray-200);
    }

    &:focus-visible {
      outline: 2px solid var(--global-color-primary);
      outline-offset: -2px;
    }
  }

  .tool-pool__title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--global-dimension-size-100);
  }

  .tool-pool__title {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    font-size: var(--global-font-size-xs);
    font-weight: 600;
    color: var(--global-text-color-700);
  }

  .tool-pool__chevron {
    font-size: 12px;
    color: var(--global-text-color-500);
    transition: transform 150ms ease;
  }

  .tool-pool__chevron[data-expanded="true"] {
    transform: rotate(0deg);
  }

  .tool-pool__chevron[data-expanded="false"] {
    transform: rotate(-90deg);
  }

  .tool-pool__status {
    font-weight: 400;
    color: var(--global-text-color-500);
  }

  .tool-pool__status[data-tone="error"] {
    color: var(--global-color-danger);
  }

  .tool-pool__breakdown {
    padding-left: calc(12px + var(--global-dimension-size-50));
  }

  .tool-pool__body {
    border-top: 1px solid var(--global-color-gray-200);

    & > .tool-part {
      margin-top: 0;
      border: none;
      border-radius: 0;
      border-bottom: 1px solid var(--global-color-gray-200);

      &:last-child {
        border-bottom: none;
      }

      /* Remove inner border-radius when nested inside a pool */
      summary {
        border-radius: 0;
      }
    }
  }
`;

type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

const TERMINAL_STATES = new Set<ToolState>([
  "output-available",
  "output-error",
  "output-denied",
]);

function formatToolState(state: ToolState) {
  switch (state) {
    case "input-streaming":
      return "Preparing command";
    case "input-available":
      return "Running";
    case "approval-requested":
      return "Awaiting approval";
    case "approval-responded":
      return "Approval received";
    case "output-available":
      return "Completed";
    case "output-error":
      return "Failed";
    case "output-denied":
      return "Denied";
  }
}

function stringifyToolValue(value: unknown) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------------
// Part grouping
// ---------------------------------------------------------------------------

type ToolPartType = Extract<UIMessage["parts"][number], { type: string }>;

type GroupedPart =
  | { kind: "text"; part: UIMessage["parts"][number]; index: number }
  | { kind: "tool-solo"; part: ToolPartType; index: number }
  | { kind: "tool-group"; parts: ToolPartType[]; startIndex: number }
  | { kind: "other"; part: UIMessage["parts"][number]; index: number };

/**
 * Minimum number of consecutive tool parts before they get collapsed into a
 * pool. Below this threshold they render individually.
 */
const TOOL_GROUP_THRESHOLD = 3;

/**
 * Returns true for parts that should be treated as "invisible" — they don't
 * break a consecutive tool run and are not rendered.
 *
 * - `step-start` parts are AI SDK step boundary markers that appear between
 *   every auto-send cycle. They carry no user-visible content.
 * - Empty text parts (whitespace-only) sometimes appear at step boundaries.
 */
function isTransparentPart(part: UIMessage["parts"][number]): boolean {
  if (part.type === "step-start") return true;
  if (isTextUIPart(part) && part.text.trim() === "") return true;
  return false;
}

/**
 * Partitions a flat `parts` array into grouped segments so that runs of
 * consecutive tool parts (>= {@link TOOL_GROUP_THRESHOLD}) are collapsed into
 * a single `tool-group` entry. Everything else passes through as-is.
 *
 * `step-start` parts and empty text parts are treated as transparent: they
 * don't break a tool run and are not rendered. This is critical because the
 * AI SDK inserts a `step-start` between every auto-send cycle, so tool calls
 * in an agent loop are always separated by step boundaries.
 */
function groupMessageParts(parts: UIMessage["parts"]): GroupedPart[] {
  const result: GroupedPart[] = [];
  let toolRun: { parts: ToolPartType[]; startIndex: number } | null = null;

  const flushToolRun = () => {
    if (!toolRun) return;
    if (toolRun.parts.length >= TOOL_GROUP_THRESHOLD) {
      result.push({
        kind: "tool-group",
        parts: toolRun.parts,
        startIndex: toolRun.startIndex,
      });
    } else {
      // Below threshold — render each tool individually
      for (let j = 0; j < toolRun.parts.length; j++) {
        result.push({
          kind: "tool-solo",
          part: toolRun.parts[j],
          index: toolRun.startIndex + j,
        });
      }
    }
    toolRun = null;
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Skip invisible parts — they don't break tool runs and aren't rendered
    if (isTransparentPart(part)) {
      continue;
    }

    if (isToolUIPart(part)) {
      if (!toolRun) {
        toolRun = { parts: [], startIndex: i };
      }
      toolRun.parts.push(part as ToolPartType);
    } else {
      flushToolRun();
      if (isTextUIPart(part)) {
        result.push({ kind: "text", part, index: i });
      } else {
        result.push({ kind: "other", part, index: i });
      }
    }
  }
  flushToolRun();

  return result;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Collapsible detail view for a single tool invocation within an assistant
 * message. For bash tool calls it shows the command, exit code, duration,
 * and stdout/stderr using typed helpers from the bash tool barrel.
 * Falls back to generic JSON rendering for unknown tools.
 */
function ToolPart({
  part,
}: {
  part: Extract<UIMessage["parts"][number], { type: string }>;
}) {
  if (!isToolUIPart(part)) {
    return null;
  }

  const toolName = getToolName(part);
  const bashInput = toolName === "bash" ? getBashToolInput(part.input) : null;
  const bashResult =
    toolName === "bash" ? getBashToolCommandDisplayResult(part.output) : null;
  const command = bashInput?.command ?? stringifyToolValue(part.input);
  const isError = part.state === "output-error";

  // Extract a short preview of the command for the collapsed summary.
  // Use the first line only, since multi-line commands are common.
  const preview = command ? command.split("\n")[0] : "";

  return (
    <details className="tool-part" css={toolPartCSS}>
      <summary>
        <div className="tool-part__summary">
          <span className="tool-part__title">
            <Icon svg={<Icons.ChevronDown />} className="tool-part__chevron" />
            Tool: {toolName}
          </span>
          {preview ? (
            <span className="tool-part__preview">{preview}</span>
          ) : null}
          <span
            className="tool-part__status"
            data-tone={isError ? "error" : undefined}
          >
            {formatToolState(part.state)}
          </span>
        </div>
      </summary>
      <div>
        <span className="tool-part__label">Command</span>
        <pre>{command || "(empty)"}</pre>
        {part.state === "output-available" ? (
          <>
            <span className="tool-part__label">Exit code</span>
            <pre>{bashResult?.exitCode ?? "0"}</pre>
            {bashResult?.durationText ? (
              <>
                <span className="tool-part__label">Duration</span>
                <pre>{bashResult.durationText}</pre>
              </>
            ) : null}
            <span className="tool-part__label">Stdout</span>
            <pre>
              {bashResult?.stdout || "(no output)"}
              {bashResult?.stdoutBytesText
                ? `\n\n[${bashResult.stdoutBytesText}]`
                : ""}
            </pre>
            <span className="tool-part__label">Stderr</span>
            <pre>
              {bashResult?.stderr || "(no output)"}
              {bashResult?.stderrBytesText
                ? `\n\n[${bashResult.stderrBytesText}]`
                : ""}
            </pre>
          </>
        ) : null}
        {part.state === "output-error" ? (
          <>
            <span className="tool-part__label">Error</span>
            <pre>{part.errorText}</pre>
          </>
        ) : null}
      </div>
    </details>
  );
}

/**
 * Computes summary statistics for a group of tool parts: counts by tool name,
 * counts by terminal status, and whether all tools have finished.
 */
function useToolPoolStats(parts: ToolPartType[]) {
  return useMemo(() => {
    const byName = new Map<string, number>();
    let completed = 0;
    let failed = 0;
    let running = 0;

    for (const part of parts) {
      if (!isToolUIPart(part)) continue;
      const name = getToolName(part);
      byName.set(name, (byName.get(name) ?? 0) + 1);

      if (part.state === "output-available") {
        completed++;
      } else if (part.state === "output-error") {
        failed++;
      } else if (part.state === "output-denied") {
        // count denied as failed for display purposes
        failed++;
      } else {
        running++;
      }
    }

    const allDone = parts.every(
      (p) => isToolUIPart(p) && TERMINAL_STATES.has(p.state as ToolState)
    );

    return { byName, completed, failed, running, allDone, total: parts.length };
  }, [parts]);
}

/**
 * Builds a compact status suffix for the pool title.
 *
 * Examples:
 *  - "completed"
 *  - "3 of 8 running..."
 *  - "7 completed, 1 failed"
 */
function formatPoolStatus({
  completed,
  failed,
  running,
  total,
}: {
  completed: number;
  failed: number;
  running: number;
  total: number;
}): { text: string; tone?: "error" } {
  if (running > 0) {
    return {
      text: `${completed + failed} of ${total} done, ${running} running\u2026`,
    };
  }
  if (failed > 0) {
    return {
      text: `${completed} completed, ${failed} failed`,
      tone: "error",
    };
  }
  return { text: "completed" };
}

/**
 * Collapsed pool for a run of consecutive tool calls. Shows a compact summary
 * header with tool-type breakdown badges. Expands to reveal individual
 * {@link ToolPart} details.
 *
 * Starts collapsed. The user controls open/close exclusively — no automatic
 * toggling as tool states change, which avoids jitter during rapid tool
 * execution.
 */
function ToolPartGroup({ parts }: { parts: ToolPartType[] }) {
  const stats = useToolPoolStats(parts);
  const [isExpanded, setIsExpanded] = useState(false);

  const { text: statusText, tone: statusTone } = formatPoolStatus(stats);

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className="tool-pool" css={toolPoolCSS}>
      <div
        className="tool-pool__header"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <div className="tool-pool__title-row">
          <span className="tool-pool__title">
            <Icon
              svg={<Icons.ChevronDown />}
              className="tool-pool__chevron"
              data-expanded={isExpanded}
            />
            {stats.total} tool call{stats.total === 1 ? "" : "s"}{" "}
            <span
              className="tool-pool__status"
              data-tone={statusTone ?? undefined}
            >
              {statusText}
            </span>
          </span>
        </div>
        <div className="tool-pool__breakdown">
          <Flex gap="size-50" wrap>
            {Array.from(stats.byName.entries()).map(([name, count]) => (
              <Badge key={name} size="S">
                {name}
                {count > 1 ? ` \u00D7${count}` : ""}
              </Badge>
            ))}
            {stats.failed > 0 ? (
              <Badge size="S" variant="danger">
                {stats.failed} failed
              </Badge>
            ) : null}
          </Flex>
        </div>
      </div>
      {isExpanded ? (
        <div className="tool-pool__body">
          {parts.map((part, i) => (
            <ToolPart key={i} part={part} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Renders a user message bubble (right-aligned, primary colour). */
export function UserMessage({ parts }: { parts: UIMessage["parts"] }) {
  return (
    <div css={userMessageCSS}>
      {parts
        .filter(isTextUIPart)
        .map((p) => p.text)
        .join("")}
    </div>
  );
}

/**
 * Renders an assistant message consisting of interleaved text and tool-call
 * parts. Consecutive runs of 3+ tool calls are collapsed into a
 * {@link ToolPartGroup} pool; shorter runs render individually as
 * {@link ToolPart} details.
 */
export function AssistantMessage({ parts }: { parts: UIMessage["parts"] }) {
  const grouped = useMemo(() => groupMessageParts(parts), [parts]);

  return (
    <div css={assistantMessageCSS}>
      {grouped.map((group) => {
        switch (group.kind) {
          case "text":
            return (
              <MarkdownBlock
                key={`text-${group.index}`}
                mode="markdown"
                margin="none"
              >
                {group.part.type === "text" ? group.part.text : ""}
              </MarkdownBlock>
            );
          case "tool-solo":
            return <ToolPart key={`tool-${group.index}`} part={group.part} />;
          case "tool-group":
            return (
              <ToolPartGroup
                key={`pool-${group.startIndex}`}
                parts={group.parts}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
