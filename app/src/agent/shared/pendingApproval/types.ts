import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import type { ApprovalSource } from "@phoenix/agent/tools/approval";

export type { ApprovalSource };

export type ApprovalToolOutputSender = Chat<UIMessage>["addToolOutput"];

/** The result of applying an approved write (returned by each tool's commit fn). */
export type ApprovalApplyResult =
  | { ok: true; output: string }
  | { ok: false; error: string };

/**
 * A write proposed by a tool call and awaiting the user's Accept/Reject in
 * manual edit mode, generic over the `TPreview` payload the tool's card
 * renders. `accept`/`reject` are bound by {@link bindPendingApproval}; they are
 * absent once the proposal can no longer be acted on (e.g. after a refresh).
 */
export type PendingApproval<TPreview> = {
  toolCallId: string;
  sessionId: string | null;
  /** Server tool name, so output is attributed to the right tool. */
  toolName: string;
  preview: TPreview;
  accept?: (options?: { approvalSource?: ApprovalSource }) => Promise<void>;
  reject?: () => Promise<void>;
};

export type BindPendingApprovalOptions<TPreview> = {
  pending: Pick<
    PendingApproval<TPreview>,
    "toolCallId" | "sessionId" | "toolName" | "preview"
  >;
  /** Performs the actual write; called only on accept (or auto-accept). */
  apply: () => Promise<ApprovalApplyResult>;
  addToolOutput: ApprovalToolOutputSender;
  setPending: (
    toolCallId: string,
    pending: PendingApproval<TPreview> | null
  ) => void;
  /** Message reported to the model when the user rejects. */
  rejectedMessage: string;
};
