import { patchExperimentInputSchema } from "@phoenix/agent/tools/patchExperiment/schemas";

import type { UiOperationDescriptor } from "../types";
import { defineUiOperation } from "../types";

/**
 * Catalog entry replacing the standalone `patch_experiment` tool. An
 * approval operation: the browser resolves the experiment (never trusting a
 * model-supplied name), stages the field diff for review, and the promise
 * resolves with the user's decision. Registered at the app root. The input
 * schema is reused from the existing tool module; the description is ported
 * from the Python `DESCRIPTION`.
 */
export const patchExperimentOperation = defineUiOperation({
  name: "experiment.patch",
  description:
    "Edit an existing experiment's name, description, or metadata. Use this to record " +
    "observations or notes on an experiment after reviewing its results, or to rename or " +
    "redescribe it. Provide `experimentId` plus at least one field to change; omitted fields " +
    "are left untouched. `metadata` replaces the experiment's metadata object as a whole, so " +
    "read the current metadata first and resubmit the complete object when appending.",
  inputSchema: patchExperimentInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
});

/** All experiment operations, for catalog assembly and root registration. */
export const experimentOperations: UiOperationDescriptor[] = [
  patchExperimentOperation,
];
