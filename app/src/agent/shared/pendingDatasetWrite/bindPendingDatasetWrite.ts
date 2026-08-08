import { bindPendingApproval } from "@phoenix/agent/shared/pendingApproval";

import type {
  BindPendingDatasetWriteOptions,
  PendingDatasetWrite,
} from "./types";

const REJECTED_MESSAGE =
  "The user rejected the proposed dataset change, so nothing was written.";

/**
 * Dataset-specific wrapper over the generic {@link bindPendingApproval}: fills
 * in the dataset reject message and adapts the dataset-named store setter. The
 * accept/reject/apply mechanics live in the generic core.
 */
export function bindPendingDatasetWrite({
  pending,
  apply,
  addToolOutput,
  setPendingDatasetWrite,
}: BindPendingDatasetWriteOptions): PendingDatasetWrite {
  return bindPendingApproval({
    pending,
    apply,
    addToolOutput,
    setPending: setPendingDatasetWrite,
    rejectedMessage: REJECTED_MESSAGE,
  });
}
