import { bindPendingApproval } from "@phoenix/agent/shared/pendingApproval";

import type {
  BindPendingDatasetWriteOptions,
  PendingDatasetWrite,
} from "./types";

const REJECTED_MESSAGE =
  "You rejected the proposed dataset change, so nothing was written.";

/**
 * Dataset-specific wrapper over the generic {@link bindPendingApproval}: adapts
 * the dataset `apply` (which returns a plain success message) into the generic
 * commit's `{ status: "accepted", ... }` output, fills in the dataset reject
 * message, and adapts the dataset-named store setter. Dataset writes have no
 * navigation-cancel path, so no `navigationCancelError` is supplied.
 */
export function bindPendingDatasetWrite({
  pending,
  apply,
  addToolOutput,
  setPendingDatasetWrite,
}: BindPendingDatasetWriteOptions): PendingDatasetWrite {
  return bindPendingApproval<PendingDatasetWrite>({
    pending,
    addToolOutput,
    clearPending: (toolCallId) => setPendingDatasetWrite(toolCallId, null),
    commit: async ({ approvalSource }) => {
      const result = await apply();
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return {
        ok: true,
        output: {
          status: "accepted",
          acceptedBy: approvalSource,
          message: result.output,
        },
      };
    },
    buildRejectedOutput: () => ({
      status: "rejected",
      message: REJECTED_MESSAGE,
    }),
  });
}
