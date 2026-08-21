import {
  isToolUIPart,
  type ChatStatus,
  type DynamicToolUIPart,
  type ToolUIPart,
  type UIDataTypes,
  type UIMessagePart,
  type UITools,
} from "ai";

import type { components } from "@phoenix/api/__generated__/v1";
import { isRecord } from "@phoenix/utils/typeUtils";

/** A user's answer to a tool call awaiting approval, as the API models it. */
export type SubmittedToolApproval = components["schemas"]["ToolApproval"];

/** Whether the chat has a request in flight (submitted or streaming). */
export function isRequestActive(status: ChatStatus): boolean {
  return status === "submitted" || status === "streaming";
}

/** A tool part in a terminal output state (`output-available` / `output-error`). */
export type ResolvedToolOutputPart<TOOLS extends UITools = UITools> = Extract<
  ToolUIPart<TOOLS> | DynamicToolUIPart,
  { state: "output-available" | "output-error" }
>;

/**
 * Whether the server stamped this tool call as delegated to the browser, via
 * its `phoenix.toolExecutionEnvironment` call provider metadata.
 */
function isClientExecutedToolPart(
  part: Pick<DynamicToolUIPart, "providerExecuted" | "callProviderMetadata">
): boolean {
  if (part.providerExecuted) {
    return false;
  }
  const callProviderMetadata: unknown = part.callProviderMetadata;
  const phoenixMetadata: unknown = isRecord(callProviderMetadata)
    ? callProviderMetadata.phoenix
    : null;
  return (
    isRecord(phoenixMetadata) &&
    phoenixMetadata.toolExecutionEnvironment === "client"
  );
}

/**
 * Whether a message part is a client-executed tool call in a terminal output
 * state — the parts a request may carry to the server as `toolOutputs`.
 */
export function isResolvedClientToolOutputPart<TOOLS extends UITools>(
  part: UIMessagePart<UIDataTypes, TOOLS>
): part is ResolvedToolOutputPart<TOOLS> {
  if (!isToolUIPart(part)) {
    return false;
  }
  if (part.state !== "output-available" && part.state !== "output-error") {
    return false;
  }
  return isClientExecutedToolPart(part);
}

/** A tool part carrying the user's answer to an approval request. */
export type AnsweredToolApprovalPart<TOOLS extends UITools = UITools> = Extract<
  ToolUIPart<TOOLS> | DynamicToolUIPart,
  { state: "approval-responded" }
>;

/**
 * Whether a message part is an answered approval — the parts a request
 * carries to the server as `toolApprovals`.
 */
export function isAnsweredToolApprovalPart<TOOLS extends UITools>(
  part: UIMessagePart<UIDataTypes, TOOLS>
): part is AnsweredToolApprovalPart<TOOLS> {
  return isToolUIPart(part) && part.state === "approval-responded";
}

/**
 * Project an answered approval onto the wire shape the tool-approvals route
 * and the chat continuation share. Only the decision travels: the server
 * copies the rest from the persisted call, so a client cannot approve one
 * tool input and persist another.
 */
export function toSubmittedToolApproval(
  part: AnsweredToolApprovalPart
): SubmittedToolApproval {
  return { toolCallId: part.toolCallId, approved: part.approval.approved };
}

/**
 * Whether a message part is a client-executed tool call still awaiting its
 * output (`input-available`).
 */
export function isPendingClientToolCallPart<TOOLS extends UITools>(
  part: UIMessagePart<UIDataTypes, TOOLS>
): part is ToolUIPart<TOOLS> | DynamicToolUIPart {
  if (!isToolUIPart(part)) {
    return false;
  }
  if (part.state !== "input-available") {
    return false;
  }
  return isClientExecutedToolPart(part);
}
