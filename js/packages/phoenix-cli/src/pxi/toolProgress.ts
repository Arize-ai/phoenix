import type { UIDataTypes, UIMessagePart, UITools } from "ai";

import { getToolPresentation, type ToolPresentation } from "./toolPresentation";
import type { PxiMessage } from "./types";

/**
 * Distills the AI SDK's tool-call message parts into a small, display-ready
 * {@link ToolProgress} shape the UI can render directly. The SDK models a tool
 * call as a sequence of parts moving through lifecycle states; this module reads
 * the current state and produces a human-readable status line plus an optional
 * one-line summary of the tool's input or output.
 */

/** Lifecycle state of a single tool call, mirroring the AI SDK's part states. */
export type ToolProgressState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

/** A display-ready summary of one tool call's current progress. */
export type ToolProgress = {
  toolCallId: string;
  toolName: string;
  state: ToolProgressState;
  statusText: string;
  errorText?: string;
} & ToolPresentation;

type PxiToolPart = UIMessagePart<UIDataTypes, UITools> & {
  toolCallId: string;
  state: ToolProgressState;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

/**
 * Type guard recognizing the message parts that represent a tool call — both
 * statically-typed (`tool-*`) and dynamic tools — so non-tool parts (like text)
 * are skipped.
 */
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

/** Map a lifecycle state to the short human-readable label shown to the user. */
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
    default:
      return assertNever(state);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unknown tool progress state: ${String(value)}`);
}

/**
 * Collect the progress of every tool call across a list of messages, in order,
 * skipping non-tool parts.
 */
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

/**
 * Convert a single message part into a {@link ToolProgress}, or `null` if the
 * part isn't a tool call. This is the core mapping that derives the tool name,
 * status label, detail summary, and any error text from the raw SDK part.
 */
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
  const errorText = "errorText" in part ? part.errorText : undefined;
  return {
    toolCallId: part.toolCallId,
    toolName,
    state,
    statusText: getStatusText(state),
    errorText,
    ...getToolPresentation({
      toolName,
      state,
      input: part.input,
      output: part.output,
      errorText,
    }),
  };
}

/** Concatenate the text of all text parts in a message, ignoring tool parts. */
export function getMessageText({ message }: { message: PxiMessage }): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}
