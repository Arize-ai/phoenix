export type ApprovalSource = "user" | "auto";

/** The result of applying an approved write (returned by each tool's commit fn). */
export type ApprovalApplyResult =
  | { ok: true; output: string }
  | { ok: false; error: string };

/**
 * A write proposed by a tool call and awaiting the user's Accept/Reject in
 * manual edit mode, generic over the `TPreview` payload the tool's card
 * renders. `accept`/`reject` are absent once the proposal can no longer be
 * acted on (e.g. after a refresh).
 */
export type PendingApproval<TPreview> = {
  toolCallId: string;
  /** Server tool name, so output is attributed to the right tool. */
  toolName: string;
  preview: TPreview;
  accept?: (options?: { approvalSource?: ApprovalSource }) => Promise<void>;
  reject?: () => Promise<void>;
};
