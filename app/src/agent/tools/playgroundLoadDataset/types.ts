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

/** Playground selection captured at propose time; re-checked for drift before the accept-time dual-write. */
export type ExpectedSelection = {
  datasetId: string | null;
  splitIds: string[];
};

export type ResolvedDatasetTarget = {
  datasetId: string;
  datasetName: string;
  /** Resolved split, present only when the input supplied a split name. */
  splitId: string | null;
  splitName: string | null;
};

export type DatasetTargetResolution =
  | { ok: true; output: ResolvedDatasetTarget }
  | { ok: false; error: string };

/** Resolves a dataset/split name pair to ids, validating existence + emptiness. */
export type ResolveDatasetTarget = (
  input: LoadDatasetInput
) => Promise<DatasetTargetResolution>;

export type PendingLoadDataset = {
  toolCallId: string;
  /** Agent session that owns the unresolved load_dataset tool call. */
  sessionId: string;
  /** Parsed load_dataset input awaiting user approval. */
  input: LoadDatasetInput;
  /** Resolved target shown on the card and applied verbatim on accept. */
  snapshot: DatasetSelectionSnapshot;
  /** Selection at propose time, re-checked at accept to detect drift. */
  expectedSelection: ExpectedSelection;
  /** djb2 revision of `expectedSelection`, re-checked at accept. */
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
  /** Re-resolves the proposed target at accept to confirm it still exists. */
  resolveDatasetTarget: ResolveDatasetTarget;
  /** Reads the live selection to detect drift since propose time. */
  readSelectionRevision: () => string;
  /** Performs the store + URL dual-write that flips the playground into dataset mode. */
  applyDatasetSelection: ApplyDatasetSelection;
  addToolOutput: LoadDatasetToolOutputSender;
  setPendingLoadDataset: (
    toolCallId: string,
    pendingLoad: PendingLoadDataset | null
  ) => void;
};
