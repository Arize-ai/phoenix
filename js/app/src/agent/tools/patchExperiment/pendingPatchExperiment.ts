import { approvalOutcome } from "@phoenix/agent/shared/pendingApproval";

import {
  PATCH_EXPERIMENT_NAVIGATION_CANCEL_ERROR,
  PATCH_EXPERIMENT_STALE_TARGET_ERROR,
  PATCH_EXPERIMENT_TOOL_NAME,
} from "./constants";
import type {
  BindPendingPatchExperimentOperationOptions,
  BindPendingPatchExperimentOptions,
  PatchExperimentFieldDiff,
  PendingPatchExperiment,
} from "./types";

function toChangeOutput(diff: PatchExperimentFieldDiff[]) {
  return diff.map((change) => ({
    field: change.field,
    previous: change.previous,
    new: change.next,
  }));
}

/**
 * Render one side of a pending experiment edit as text, for the unified-diff
 * body of the script-child approval card.
 */
export function patchExperimentDiffToText(
  diff: PatchExperimentFieldDiff[],
  side: "previous" | "next"
): string {
  return diff
    .map((change) => `${change.field}: ${change[side] ?? "(none)"}`)
    .join("\n");
}

export function bindPendingPatchExperimentActions({
  pendingPatch,
  fetchExperimentSnapshot,
  commitPatchExperiment,
  addToolOutput,
  setPendingPatchExperiment,
}: BindPendingPatchExperimentOptions): PendingPatchExperiment {
  const { experimentId, experimentName, payload, diff } = pendingPatch;
  return {
    ...pendingPatch,
    accept: async ({ approvalSource = "user" } = {}) => {
      setPendingPatchExperiment(pendingPatch.toolCallId, null);

      let currentUpdatedAt: string;
      try {
        currentUpdatedAt = (await fetchExperimentSnapshot(experimentId))
          .updatedAt;
      } catch (error) {
        await addToolOutput({
          state: "output-error",
          tool: PATCH_EXPERIMENT_TOOL_NAME,
          toolCallId: pendingPatch.toolCallId,
          errorText:
            error instanceof Error
              ? error.message
              : "Failed to re-read the experiment before applying the edit.",
        });
        return;
      }

      // Re-fetch only checks for drift; the committed payload is the stored one.
      if (currentUpdatedAt !== pendingPatch.expectedUpdatedAt) {
        await addToolOutput({
          state: "output-error",
          tool: PATCH_EXPERIMENT_TOOL_NAME,
          toolCallId: pendingPatch.toolCallId,
          errorText: PATCH_EXPERIMENT_STALE_TARGET_ERROR,
        });
        return;
      }

      try {
        await commitPatchExperiment({ experimentId, payload });
      } catch (error) {
        await addToolOutput({
          state: "output-error",
          tool: PATCH_EXPERIMENT_TOOL_NAME,
          toolCallId: pendingPatch.toolCallId,
          errorText:
            error instanceof Error
              ? error.message
              : "Failed to apply the experiment edit.",
        });
        return;
      }

      await addToolOutput({
        state: "output-available",
        tool: PATCH_EXPERIMENT_TOOL_NAME,
        toolCallId: pendingPatch.toolCallId,
        output: {
          status: "applied",
          acceptedBy: approvalSource,
          experimentId,
          experimentName,
          changes: toChangeOutput(diff),
          message:
            approvalSource === "auto"
              ? `Experiment "${experimentName}" edit auto-applied.`
              : `Experiment "${experimentName}" updated.`,
          ...approvalOutcome({ decision: "accepted", source: approvalSource }),
        },
      });
    },
    reject: async () => {
      setPendingPatchExperiment(pendingPatch.toolCallId, null);
      await addToolOutput({
        state: "output-available",
        tool: PATCH_EXPERIMENT_TOOL_NAME,
        toolCallId: pendingPatch.toolCallId,
        output: {
          status: "rejected",
          experimentId,
          experimentName,
          changes: toChangeOutput(diff),
          message: `User rejected the proposed edit to experiment "${experimentName}".`,
          ...approvalOutcome({ decision: "rejected", source: "user" }),
        },
      });
    },
    cancel: async () => {
      setPendingPatchExperiment(pendingPatch.toolCallId, null);
      await addToolOutput({
        state: "output-error",
        tool: PATCH_EXPERIMENT_TOOL_NAME,
        toolCallId: pendingPatch.toolCallId,
        errorText: PATCH_EXPERIMENT_NAVIGATION_CANCEL_ERROR,
        outcome: "interrupted",
      });
    },
  };
}

/**
 * The operation-flavored counterpart of
 * {@link bindPendingPatchExperimentActions}: accept/reject/cancel resolve the
 * promise the calling `execute_browser_action` script awaits via `emitResult` instead of
 * writing tool output. Apply failures and drift resolve `{ ok: false }`;
 * rejection resolves `{ ok: true, output: { status: "rejected", … } }` so the
 * script continues with the user's answer.
 */
export function bindPendingPatchExperimentOperationActions({
  pendingPatch,
  fetchExperimentSnapshot,
  commitPatchExperiment,
  emitResult,
  setPendingPatchExperiment,
}: BindPendingPatchExperimentOperationOptions): PendingPatchExperiment {
  const { experimentId, experimentName, payload, diff } = pendingPatch;
  return {
    ...pendingPatch,
    accept: async ({ approvalSource = "user" } = {}) => {
      setPendingPatchExperiment(pendingPatch.toolCallId, null);

      let currentUpdatedAt: string;
      try {
        currentUpdatedAt = (await fetchExperimentSnapshot(experimentId))
          .updatedAt;
      } catch (error) {
        emitResult({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to re-read the experiment before applying the edit.",
        });
        return;
      }

      // Re-fetch only checks for drift; the committed payload is the stored one.
      if (currentUpdatedAt !== pendingPatch.expectedUpdatedAt) {
        emitResult({ ok: false, error: PATCH_EXPERIMENT_STALE_TARGET_ERROR });
        return;
      }

      try {
        await commitPatchExperiment({ experimentId, payload });
      } catch (error) {
        emitResult({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to apply the experiment edit.",
        });
        return;
      }

      emitResult({
        ok: true,
        output: {
          status: "applied",
          acceptedBy: approvalSource,
          experimentId,
          experimentName,
          changes: toChangeOutput(diff),
          message:
            approvalSource === "auto"
              ? `Experiment "${experimentName}" edit auto-applied.`
              : `Experiment "${experimentName}" updated.`,
        },
      });
    },
    reject: async () => {
      setPendingPatchExperiment(pendingPatch.toolCallId, null);
      emitResult({
        ok: true,
        output: {
          status: "rejected",
          experimentId,
          experimentName,
          changes: toChangeOutput(diff),
          message: `User rejected the proposed edit to experiment "${experimentName}".`,
        },
      });
    },
    cancel: async () => {
      setPendingPatchExperiment(pendingPatch.toolCallId, null);
      emitResult({
        ok: false,
        error: PATCH_EXPERIMENT_NAVIGATION_CANCEL_ERROR,
      });
    },
  };
}
