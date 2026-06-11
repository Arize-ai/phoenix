import type { z } from "zod";

import type { ApprovalSource } from "@phoenix/agent/tools/approval";

import type {
  patchExperimentActionContextSchema,
  patchExperimentInputSchema,
  PatchExperimentToolOutputSender,
} from "./schemas";

export type { ApprovalSource };
export type { PatchExperimentToolOutputSender } from "./schemas";

/** Parsed input for `patch_experiment`. */
export type PatchExperimentInput = z.output<typeof patchExperimentInputSchema>;

export type PatchExperimentActionContext = z.output<
  typeof patchExperimentActionContextSchema
>;

/**
 * The fields a single experiment patch may touch. Only keys present here are
 * written; `description: null` clears the column. Committed verbatim from the
 * pending record so the write matches exactly what the approval card showed.
 */
export type PatchExperimentPayload = {
  name?: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
};

/** Snapshot of the target experiment captured at propose time. */
export type ExperimentSnapshot = {
  name: string;
  description: string | null;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

/** One field's before/after values for the approval card's diff. */
export type PatchExperimentFieldDiff = {
  field: "name" | "description" | "metadata";
  previous: string | null;
  next: string | null;
};

export type PendingPatchExperiment = {
  toolCallId: string;
  sessionId: string;
  /** Target experiment node id the patch commits against. */
  experimentId: string;
  /** Resolved target name from the fetched experiment, never from input. */
  experimentName: string;
  /** `updatedAt` captured at propose time; re-checked before committing. */
  expectedUpdatedAt: string;
  /** Canonical patch committed verbatim at accept time. */
  payload: PatchExperimentPayload;
  /** Field-level before/after preview rendered on the card. */
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
