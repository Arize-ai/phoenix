import {
  isToolUIPart,
  type ChatStatus,
  type DynamicToolUIPart,
  type ToolUIPart,
  type UIDataTypes,
  type UIMessagePart,
  type UITools,
} from "ai";

import { isRecord } from "@phoenix/utils/typeUtils";

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
