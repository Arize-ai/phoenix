import type {
  ApprovalApplyResult,
  ApprovalToolOutputSender,
  PendingApproval,
} from "@phoenix/agent/shared/pendingApproval";

export type { ApprovalSource } from "@phoenix/agent/shared/pendingApproval";

/** Re-export of the generic output sender, kept under the dataset name. */
export type DatasetWriteToolOutputSender = ApprovalToolOutputSender;

/** One row in a previewed dataset write. */
export type DatasetWriteExampleRow = {
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

/** What a pending dataset write will do, rendered in the approval card. */
export type DatasetWritePreview =
  | {
      kind: "create";
      name: string;
      description?: string | null;
      examples?: DatasetWriteExampleRow[];
    }
  | { kind: "add"; examples: DatasetWriteExampleRow[] }
  | {
      kind: "create-split";
      name: string;
      description?: string | null;
      color: string;
      exampleCount: number;
    }
  | {
      kind: "set-splits";
      splitNames: string[];
      exampleCount: number;
    }
  | {
      kind: "create-label";
      name: string;
      description?: string | null;
      color: string;
      attachToDataset: boolean;
    }
  | {
      kind: "set-labels";
      labelNames: string[];
    }
  | { kind: "patch-dataset"; changes: Record<string, unknown> }
  | { kind: "delete-dataset"; datasetName: string }
  | { kind: "patch-examples"; exampleCount: number }
  | { kind: "delete-examples"; exampleCount: number }
  | {
      kind: "patch-split";
      splitName: string;
      changes: Record<string, unknown>;
    }
  | { kind: "delete-splits"; splitNames: string[] }
  | { kind: "delete-labels"; labelNames: string[] }
  | { kind: "add-spans"; datasetName: string; spanCount: number };

/** Outcome of applying a dataset write (the generic apply result). */
export type DatasetWriteApplyResult = ApprovalApplyResult;

/**
 * A dataset write (create dataset / add examples / split & label changes)
 * proposed by a tool call and awaiting the user's Accept/Reject in manual edit
 * mode — the generic {@link PendingApproval} specialized to the dataset preview.
 */
export type PendingDatasetWrite = PendingApproval<DatasetWritePreview>;

export type BindPendingDatasetWriteOptions = {
  pending: Pick<PendingDatasetWrite, "toolCallId" | "toolName" | "preview">;
  /** Performs the actual write; called only on accept (or auto-accept). */
  apply: () => Promise<DatasetWriteApplyResult>;
  addToolOutput: DatasetWriteToolOutputSender;
  setPendingDatasetWrite: (
    toolCallId: string,
    pending: PendingDatasetWrite | null
  ) => void;
};
