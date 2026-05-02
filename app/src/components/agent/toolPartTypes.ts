import type { UIMessage } from "ai";
import { isToolUIPart } from "ai";

/**
 * Union type of all message parts.
 */
export type MessagePart = UIMessage["parts"][number];

/**
 * Extract the subset of message parts that represent tool invocations
 * (both static `tool-*` and `dynamic-tool` types). This matches the
 * union that `isToolUIPart` narrows to, including `input`, `output`,
 * `state`, `errorText`, etc.
 */
export type ToolInvocationPart = Extract<
  MessagePart,
  { type: `tool-${string}` } | { type: "dynamic-tool" }
>;

/**
 * The lifecycle state of a tool invocation part.
 */
export type ToolUIPartState = ToolInvocationPart["state"];

// Re-export the SDK guard for convenience
export { isToolUIPart };

/**
 * Formats a tool state into a human-readable label.
 */
export function formatToolState(state: ToolUIPartState): string {
  switch (state) {
    case "input-streaming":
      return "Preparing";
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

/**
 * Safely stringify a tool value for display.
 */
export function stringifyToolValue(value: unknown): string {
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
