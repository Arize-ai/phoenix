import type { components } from "@phoenix/api/__generated__/v1";

import {
  isAnsweredToolApprovalPart,
  toSubmittedToolApproval,
  type SubmittedToolApproval,
} from "./chatUtils";
import { isInterruptedToolCallPart } from "./shouldSendAutomatically";
import type { LocallyInterruptedToolCallIds } from "./shouldSendAutomatically";
import type { AgentUIMessage } from "./types";

type SubmitToolApprovalsRequestBody =
  components["schemas"]["SubmitAgentSessionToolApprovalsRequestBody"];

/** Answered approvals on a message with requests still unanswered. */
export function getFlushableToolApprovals({
  message,
  locallyInterruptedToolCallIds,
}: {
  /** The transcript's trailing assistant message. */
  message: AgentUIMessage;
  locallyInterruptedToolCallIds: LocallyInterruptedToolCallIds;
}): SubmittedToolApproval[] {
  if (message.role !== "assistant") {
    return [];
  }
  // A stopped turn's unresolved parts are rewritten as interrupted.
  const isInterrupted = message.parts.some((part) =>
    isInterruptedToolCallPart({ part, locallyInterruptedToolCallIds })
  );
  if (isInterrupted) {
    return [];
  }
  return message.parts
    .filter((part) => isAnsweredToolApprovalPart(part))
    .map((part) => toSubmittedToolApproval(part));
}

/**
 * Eagerly persists answered approvals while sibling requests are still
 * unanswered, so a transcript resync cannot reset them.
 */
export function flushToolApprovals({
  message,
  flushUrl,
  fetch: fetchFn,
  locallyInterruptedToolCallIds = {},
}: {
  /** The transcript's trailing assistant message. */
  message: AgentUIMessage;
  flushUrl: string;
  fetch: typeof fetch;
  /** Tool calls this client resolved as interrupted; suppresses the flush. */
  locallyInterruptedToolCallIds?: LocallyInterruptedToolCallIds;
}): Promise<unknown> {
  const toolApprovals = getFlushableToolApprovals({
    message,
    locallyInterruptedToolCallIds,
  });
  if (toolApprovals.length === 0) {
    return Promise.resolve();
  }
  const body: SubmitToolApprovalsRequestBody = {
    toolApprovals,
    lastMessageId: message.id,
  };
  return fetchFn(flushUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    // Benign: the chat continuation re-carries the answers.
  });
}
