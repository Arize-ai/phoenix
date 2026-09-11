import { stageApprovalOperation } from "@phoenix/agent/shared/pendingApproval";
import type {
  AgentClientActionResult,
  AgentStore,
} from "@phoenix/store/agentStore";

import type { DatasetWriteApplyResult, DatasetWritePreview } from "./types";

const DATASET_WRITE_REJECTED_MESSAGE =
  "The user rejected the proposed dataset change.";

/**
 * Stage an approval-gated dataset write on behalf of a `ui.dataset.*`
 * operation call. Accept/reject resolve the returned promise the calling
 * `execute_browser_action` script awaits.
 */
export function stageDatasetWriteOperation({
  pending,
  apply,
  agentStore,
}: {
  pending: {
    /** Inner operation call id (`<executeBrowserActionToolCallId>:<sequence>`). */
    toolCallId: string;
    /** Operation name (e.g. `dataset.create`), for attribution. */
    toolName: string;
    preview: DatasetWritePreview;
  };
  apply: () => Promise<DatasetWriteApplyResult>;
  agentStore: AgentStore;
}): Promise<AgentClientActionResult> {
  return stageApprovalOperation({
    pending,
    apply,
    setPending: agentStore.getState().setPendingDatasetWrite,
    shouldAutoAccept: () =>
      agentStore.getState().permissions.edits === "bypass",
    rejectedMessage: DATASET_WRITE_REJECTED_MESSAGE,
  });
}
