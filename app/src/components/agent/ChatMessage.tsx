import { css } from "@emotion/react";
import { getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";

import {
  getBashToolCommandDisplayResult,
  getBashToolInput,
} from "@phoenix/agent/tools/bash";
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
  max-width: 90%;
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
  }

  summary::-webkit-details-marker {
    display: none;
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
    justify-content: space-between;
    gap: var(--global-dimension-size-100);
    color: var(--global-text-color-700);
    font-size: var(--global-font-size-xs);
  }

  .tool-part__title {
    font-weight: 600;
  }

  .tool-part__status {
    color: var(--global-text-color-500);
  }

  .tool-part__status[data-tone="error"] {
    color: var(--global-color-danger);
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

type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

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

  return (
    <details className="tool-part" css={toolPartCSS}>
      <summary>
        <div className="tool-part__summary">
          <span className="tool-part__title">Tool: {toolName}</span>
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
 * parts. Text is rendered via Streamdown (markdown); tool calls are rendered
 * as collapsible {@link ToolPart} details.
 */
export function AssistantMessage({ parts }: { parts: UIMessage["parts"] }) {
  return (
    <div css={assistantMessageCSS}>
      {parts.map((part, i) => {
        if (isTextUIPart(part)) {
          return (
            <MarkdownBlock key={i} mode="markdown" margin="none">
              {part.text}
            </MarkdownBlock>
          );
        }

        if (isToolUIPart(part)) {
          return <ToolPart key={i} part={part} />;
        }

        return null;
      })}
    </div>
  );
}
