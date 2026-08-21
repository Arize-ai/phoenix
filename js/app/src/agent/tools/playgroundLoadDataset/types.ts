import type { z } from "zod";

import type { ApprovalSource } from "@phoenix/agent/tools/approval";
import type { UiOperationResultEmitter } from "@phoenix/agent/uiOperations/types";

import type { loadDatasetInputSchema } from "./schemas";

export type LoadDatasetInput = z.output<typeof loadDatasetInputSchema>;

// `splitIds` is an array to match the playground's repeated-`splitId` URL contract (v1: one split).
export type DatasetSelectionSnapshot = {
  datasetId: string;
  splitIds: string[];
  datasetName?: string;
  splitNames?: string[];
};

export type ExpectedSelection = {
  datasetId: string | null;
  splitIds: string[];
};

export type ResolvedDatasetTarget = {
  datasetId: string;
  datasetName: string;
  splitId: string | null;
  splitName: string | null;
};

export type DatasetTargetResolution =
  | { ok: true; output: ResolvedDatasetTarget }
  | { ok: false; error: string };

export type ResolveDatasetTarget = (
  input: LoadDatasetInput
) => Promise<DatasetTargetResolution>;

export type PendingLoadDataset = {
  /**
   * Key of this pending entry. Under `execute_ui` this is the inner
   * operation call id (`<toolCallId>:<sequence>`), not an AI SDK toolCallId;
   * the field keeps its historical name to limit churn across consumers.
   */
  toolCallId: string;
  /** Agent session that owns the unresolved playground.dataset.load call. */
  sessionId: string;
  input: LoadDatasetInput;
  snapshot: DatasetSelectionSnapshot;
  expectedSelection: ExpectedSelection;
  expectedRevision: string;
  accept?: (options?: { approvalSource?: ApprovalSource }) => Promise<void>;
  reject?: () => Promise<void>;
  cancel?: () => Promise<void>;
};

export type ApplyDatasetSelection = (
  snapshot: DatasetSelectionSnapshot
) => void;

export type BindPendingLoadDatasetOptions = {
  pendingLoad: PendingLoadDataset;
  resolveDatasetTarget: ResolveDatasetTarget;
  readSelectionRevision: () => string;
  applyDatasetSelection: ApplyDatasetSelection;
  /** Resolves the awaiting `execute_ui` script call with the user's decision. */
  emitResult: UiOperationResultEmitter;
  setPendingLoadDataset: (
    toolCallId: string,
    pendingLoad: PendingLoadDataset | null
  ) => void;
};
