import type { z } from "zod";

import type { ApprovalSource } from "@phoenix/agent/tools/approval";
import type { UIOperationResultEmitter } from "@phoenix/agent/uiOperations/types";

import type { navigationGoToInputSchema } from "./schemas";

export type NavigationGoToInput = z.infer<typeof navigationGoToInputSchema>;

/**
 * A navigation proposed by a `ui.navigation.goTo` call and awaiting the
 * user's Accept/Reject. `path` is already normalized and validated against
 * the route catalog; `label` is the matched route's human label.
 */
export type PendingNavigation = {
  toolCallId: string;
  sessionId: string;
  path: string;
  label: string;
  /** Model-supplied intent, rendered in the approval card. */
  reason: string;
  accept?: (options?: { approvalSource?: ApprovalSource }) => Promise<void>;
  reject?: () => Promise<void>;
};

export type BindPendingNavigationOptions = {
  pendingNavigation: PendingNavigation;
  /** Performs the route change; called only on accept. */
  navigate: (path: string) => void;
  /**
   * Reads the rendered pathname. Settle detection prefers the registered
   * router state source; this is the fallback probe for hosts without one.
   */
  getCurrentPath: () => string;
  emitResult: UIOperationResultEmitter;
  setPendingNavigation: (
    toolCallId: string,
    pending: PendingNavigation | null
  ) => void;
};
