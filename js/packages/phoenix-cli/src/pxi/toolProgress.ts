import type { UIDataTypes, UIMessagePart, UITools } from "ai";

import type { PxiMessage } from "./types";

export type ToolProgressState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

export type ToolProgress = {
  toolCallId: string;
  toolName: string;
  state: ToolProgressState;
  statusText: string;
  detailText?: string;
  errorText?: string;
};

const MAX_SUMMARY_PREVIEW_LENGTH = 80;
const MAX_SUMMARY_KEYS = 4;

function truncatePreview(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_SUMMARY_PREVIEW_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_SUMMARY_PREVIEW_LENGTH - 1)}…`;
}

function summarizeValue(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return `string (${value.length} chars): ${truncatePreview(value)}`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `array (${value.length} items)`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return "object (0 keys)";
    }
    const visibleKeys = keys.slice(0, MAX_SUMMARY_KEYS);
    const suffix = keys.length > visibleKeys.length ? ", ..." : "";
    return `object (${keys.length} keys: ${visibleKeys.join(", ")}${suffix})`;
  }
  return String(value);
}

function getDetailText({
  state,
  input,
  output,
}: {
  state: ToolProgressState;
  input?: unknown;
  output?: unknown;
}): string | undefined {
  switch (state) {
    case "input-streaming":
      return "preparing input";
    case "input-available": {
      const inputSummary = summarizeValue(input);
      return inputSummary ? `input ${inputSummary}` : "running";
    }
    case "output-available": {
      const outputSummary = summarizeValue(output);
      return outputSummary ? `result ${outputSummary}` : "complete";
    }
    case "approval-requested":
    case "approval-responded":
    case "output-error":
    case "output-denied":
      return undefined;
  }
}

type PxiToolPart = UIMessagePart<UIDataTypes, UITools> & {
  toolCallId: string;
  state: ToolProgressState;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function isPxiToolPart(
  part: UIMessagePart<UIDataTypes, UITools>
): part is PxiToolPart {
  return (
    "toolCallId" in part &&
    "state" in part &&
    (part.type === "dynamic-tool" || part.type.startsWith("tool-"))
  );
}

function getToolName(part: PxiToolPart): string {
  return part.type === "dynamic-tool"
    ? (part.toolName ?? "dynamic-tool")
    : part.type.replace(/^tool-/, "");
}

function getStatusText(state: ToolProgressState): string {
  switch (state) {
    case "input-streaming":
      return "Preparing";
    case "input-available":
      return "Running";
    case "approval-requested":
      return "Awaiting approval";
    case "approval-responded":
      return "Approval recorded";
    case "output-available":
      return "Complete";
    case "output-error":
      return "Failed";
    case "output-denied":
      return "Denied";
  }
}

export function getToolProgressFromMessages(
  messages: readonly PxiMessage[]
): ToolProgress[] {
  return messages.flatMap((message) =>
    message.parts.flatMap((part) => {
      const toolProgress = getToolProgressFromPart({ part });
      return toolProgress ? [toolProgress] : [];
    })
  );
}

export function getToolProgressFromPart({
  part,
}: {
  part: UIMessagePart<UIDataTypes, UITools>;
}): ToolProgress | null {
  if (!isPxiToolPart(part)) {
    return null;
  }
  const toolName = getToolName(part);
  const state = part.state;
  return {
    toolCallId: part.toolCallId,
    toolName,
    state,
    statusText: getStatusText(state),
    detailText: getDetailText({
      state,
      input: "input" in part ? part.input : undefined,
      output: "output" in part ? part.output : undefined,
    }),
    errorText: "errorText" in part ? part.errorText : undefined,
  };
}

export function getMessageText({ message }: { message: PxiMessage }): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}
