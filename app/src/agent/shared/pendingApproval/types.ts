import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import type { ApprovalSource } from "@phoenix/agent/tools/approval";

export type { ApprovalSource };

/** AI SDK callback used to surface a tool's output back to the model. */
export type ApprovalToolOutputSender = Chat<UIMessage>["addToolOutput"];

/**
 * Outcome of committing an approved write. `output` is the full, model-facing
 * payload each tool builds — its shape stays tool-specific and is emitted
 * verbatim, so consolidating the lifecycle does not flatten per-tool outputs.
 */
export type ApprovalCommitResult =
  | { ok: true; output: unknown }
  | { ok: false; error: string };

/**
 * Accept/reject/cancel callbacks bound onto a pending approval at dispatch or
 * mount time. They capture non-serializable runtime dependencies (Relay
 * mutations, store setters, the AI SDK `addToolOutput`), which is why only the
 * plain data is ever persisted and the behavior is rebound here.
 */
export type PendingApprovalActions = {
  accept?: (options?: { approvalSource?: ApprovalSource }) => Promise<void>;
  reject?: () => Promise<void>;
  cancel?: () => Promise<void>;
};

/** The serializable identity every pending approval shares. */
export type PendingApprovalIdentity = {
  toolCallId: string;
  /** Server tool name; the discriminant of the stored pending-approval union. */
  toolName: string;
};

/**
 * Configuration for {@link bindPendingApproval}, generic over the concrete
 * pending-approval member `T` (e.g. `PendingPromptEdit`). The tool supplies its
 * serializable `pending` data plus the three tool-specific behaviors (`commit`,
 * `buildRejectedOutput`, `navigationCancelError`); the generic core owns the
 * shared lifecycle (clear-on-resolve and output emission).
 */
export type BindPendingApprovalOptions<
  T extends PendingApprovalIdentity & PendingApprovalActions,
> = {
  /** The serializable pending data, without the lifecycle callbacks. */
  pending: Omit<T, keyof PendingApprovalActions>;
  /** Applies the approved write; called only on accept (or auto-accept). */
  commit: (options: {
    approvalSource: ApprovalSource;
  }) => Promise<ApprovalCommitResult>;
  /** Builds the model-facing output reported when the user rejects. */
  buildRejectedOutput: () => unknown;
  /**
   * Error reported when the owning surface unmounts before review. When omitted,
   * no `cancel` callback is bound — the case for approvals with no
   * navigation-cancel path (e.g. dataset writes).
   */
  navigationCancelError?: string;
  addToolOutput: ApprovalToolOutputSender;
  /** Clears this proposal from the store; runs first in every lifecycle path. */
  clearPending: (toolCallId: string) => void;
};
