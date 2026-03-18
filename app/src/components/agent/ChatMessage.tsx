import { css } from "@emotion/react";
import { getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { Streamdown } from "streamdown";

import { getBashToolInput } from "@phoenix/agent/tools/bash";

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
  const command = bashInput?.command ?? stringifyToolValue(part.input);
  const isError = part.state === "output-error";
  const result = part.state === "output-available" ? part.output : null;
  const stdout =
    result && typeof result === "object" && "stdout" in result
      ? stringifyToolValue(result.stdout)
      : "";
  const stderr =
    result && typeof result === "object" && "stderr" in result
      ? stringifyToolValue(result.stderr)
      : "";
  const exitCode =
    result && typeof result === "object" && "exitCode" in result
      ? stringifyToolValue(result.exitCode)
      : "";

  return (
    <details css={toolPartCSS}>
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
            <pre>{exitCode || "0"}</pre>
            <span className="tool-part__label">Stdout</span>
            <pre>{stdout || "(no output)"}</pre>
            <span className="tool-part__label">Stderr</span>
            <pre>{stderr || "(no output)"}</pre>
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

export function AssistantMessage({ parts }: { parts: UIMessage["parts"] }) {
  return (
    <div css={assistantMessageCSS}>
      {parts.map((part, i) => {
        if (isTextUIPart(part)) {
          return <Streamdown key={i}>{part.text}</Streamdown>;
        }

        if (isToolUIPart(part)) {
          return <ToolPart key={i} part={part} />;
        }

        return null;
      })}
    </div>
  );
}
