import { css } from "@emotion/react";
import { getToolName, isToolUIPart, type UIMessage } from "ai";

import {
  getBashToolCommandDisplayResult,
  getBashToolInput,
} from "@phoenix/agent/tools/bash";
import { Icon, Icons } from "@phoenix/components";

export type ToolPartType = Extract<
  UIMessage["parts"][number],
  { type: string }
>;

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

export const toolPartCSS = css`
  margin-top: var(--global-dimension-size-150);
  border: 1px solid var(--tool-call-border-color);
  border-radius: var(--global-rounding-medium);
  background: var(--tool-call-background-color);
  overflow: hidden;

  &:has(+ :not(.tool-part)) {
    margin-bottom: var(--global-dimension-size-150);
  }

  summary {
    cursor: pointer;
    list-style: none;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
    background: var(--tool-call-header-background-color);
    border-radius: var(--global-rounding-medium);
    transition: background 150ms ease;

    &:hover {
      background: var(--tool-call-header-background-color-hover);
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
    background: var(--tool-call-body-background-color);
    border-top: 1px solid var(--tool-call-body-border-color);
  }

  .tool-part__summary {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    color: var(--tool-call-title-color);
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
    color: var(--tool-call-secondary-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .tool-part__status {
    margin-left: auto;
    flex-shrink: 0;
    white-space: nowrap;
    font-size: var(--global-font-size-xs);
    color: var(--tool-call-secondary-color);
  }

  .tool-part__status[data-tone="error"] {
    color: var(--tool-call-error-color);
  }

  .tool-part__chevron {
    font-size: 12px;
    color: var(--tool-call-secondary-color);
    transition: transform 150ms ease;
    transform: rotate(-90deg);
  }

  .tool-part__label {
    display: block;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150) 0;
    color: var(--tool-call-secondary-color);
    font-size: var(--global-font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
`;

/**
 * Collapsible detail view for a single tool invocation within an assistant
 * message. For bash tool calls it shows the command, exit code, duration,
 * and stdout/stderr using typed helpers from the bash tool barrel.
 * Falls back to generic JSON rendering for unknown tools.
 */
export function ToolPart({
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
            <Icon
              svg={<Icons.WrenchOutline />}
              css={css`
                font-size: 0.75rem;
              `}
            />
            {toolName}
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
