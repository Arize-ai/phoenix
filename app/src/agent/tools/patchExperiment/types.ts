import type { z } from "zod";

import type { ApprovalSource } from "@phoenix/agent/tools/approval";

import type {
  patchExperimentActionContextSchema,
  patchExperimentInputSchema,
  PatchExperimentToolOutputSender,
} from "./schemas";

export type { ApprovalSource };
export type { PatchExperimentToolOutputSender } from "./schemas";

export type PatchExperimentInput = z.output<typeof patchExperimentInputSchema>;

export type PatchExperimentActionContext = z.output<
  typeof patchExperimentActionContextSchema
>;

// Only keys present are written; `description: null` clears it.
export type PatchExperimentPayload = {
  name?: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

export type ExperimentSnapshot = {
  name: string;
  description: string | null;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

export type PatchExperimentFieldDiff = {
  field: "name" | "description" | "metadata";
  previous: string | null;
  next: string | null;
};

export type PendingPatchExperiment = {
  toolCallId: string;
  sessionId: string;
  experimentId: string;
  /** Resolved from the fetched experiment, never from model input. */
  experimentName: string;
  /** Re-checked before commit to reject drift between propose and accept. */
  expectedUpdatedAt: string;
  payload: PatchExperimentPayload;
  diff: PatchExperimentFieldDiff[];
  accept?: (options?: { approvalSource?: ApprovalSource }) => Promise<void>;
  reject?: () => Promise<void>;
  cancel?: () => Promise<void>;
};

export type CommitPatchExperiment = (args: {
  experimentId: string;
  payload: PatchExperimentPayload;
}) => Promise<void>;

export type FetchExperimentSnapshot = (
  experimentId: string
) => Promise<ExperimentSnapshot>;

export type BindPendingPatchExperimentOptions = {
  pendingPatch: PendingPatchExperiment;
  fetchExperimentSnapshot: FetchExperimentSnapshot;
  commitPatchExperiment: CommitPatchExperiment;
  addToolOutput: PatchExperimentToolOutputSender;
  setPendingPatchExperiment: (
    toolCallId: string,
    patch: PendingPatchExperiment | null
  ) => void;
};
