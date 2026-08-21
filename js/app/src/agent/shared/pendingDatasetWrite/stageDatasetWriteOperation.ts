import { stageApprovalOperation } from "@phoenix/agent/shared/pendingApproval";
import type {
  AgentClientActionResult,
  AgentStore,
} from "@phoenix/store/agentStore";

import { DATASET_WRITE_REJECTED_MESSAGE } from "./bindPendingDatasetWrite";
import type { DatasetWriteApplyResult, DatasetWritePreview } from "./types";

/**
 * Stage an approval-gated dataset write on behalf of a `ui.dataset.*`
 * operation call: the operation counterpart of {@link stageDatasetWrite}.
 * The pending entry lands in the same `pendingDatasetWritesByToolCallId`
 * store record (keyed by the inner operation call id), so the shared
 * dataset approval card renders it; accept/reject resolve the returned
 * promise the calling `execute_ui` script is awaiting. Bypass edit mode
 * auto-accepts exactly like the tool path.
 */
export function stageDatasetWriteOperation({
  pending,
  apply,
  agentStore,
}: {
  pending: {
    /** Inner operation call id (`<executeUiToolCallId>:<sequence>`). */
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
