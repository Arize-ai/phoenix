import type { z } from "zod";

import type { ApprovalSource } from "@phoenix/agent/tools/approval";

import type {
  loadDatasetActionContextSchema,
  loadDatasetInputSchema,
  LoadDatasetToolOutputSender,
} from "./schemas";

export type { LoadDatasetToolOutputSender } from "./schemas";

export type LoadDatasetInput = z.output<typeof loadDatasetInputSchema>;

export type LoadDatasetActionContext = z.output<
  typeof loadDatasetActionContextSchema
>;

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
  toolCallId: string;
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
  addToolOutput: LoadDatasetToolOutputSender;
  setPendingLoadDataset: (
    toolCallId: string,
    pendingLoad: PendingLoadDataset | null
  ) => void;
};
