import { createDatasetInputSchema } from "@phoenix/agent/tools/createDataset/schemas";
import {
  deleteDatasetInputSchema,
  patchDatasetInputSchema,
} from "@phoenix/agent/tools/datasetEdit/schemas";
import {
  addDatasetExamplesInputSchema,
  deleteDatasetExamplesInputSchema,
  patchDatasetExamplesInputSchema,
} from "@phoenix/agent/tools/datasetExamples/schemas";
import { addSpansToDatasetInputSchema } from "@phoenix/agent/tools/spansToDataset/schemas";

import type { UiOperationDescriptor } from "../types";
import { defineUiOperation } from "../types";

/**
 * Catalog entries replacing the standalone dataset write tools
 * (`create_dataset`, `patch_dataset`, `delete_dataset`,
 * `add_dataset_examples`, `patch_dataset_examples`,
 * `delete_dataset_examples`, `add_spans_to_dataset`). Every one is an
 * approval operation: the browser stages the write in the shared
 * dataset-approval card and the promise resolves only after the user (or
 * bypass edit mode) decides. Handlers register at the app root — datasets
 * are not page state, so the operations are available everywhere; the ones
 * that act on "the dataset the user is viewing" resolve their target from
 * the advertised dataset context and fail with an actionable error when no
 * dataset is in view. Input schemas are reused from the existing tool
 * modules; descriptions are ported from the Python `DESCRIPTION`s with tool
 * names rewritten to operation names.
 */

const APPROVAL_UI_BEHAVIOR = {
  autoOpen: true,
  scrollIntoViewOnMount: true,
} as const;

export const createDatasetOperation = defineUiOperation({
  name: "dataset.create",
  description:
    "Create a new dataset, optionally seeded with starting rows. Each starting example has an " +
    "input object and optional output and metadata objects. Dataset names are unique; if the " +
    "name is already taken the call fails and you should pick a different name (check existing " +
    "names with the list_datasets tool). To add rows to a dataset that already exists, use " +
    "dataset.examples.add instead. If the dataset is meant to run a specific prompt in the " +
    "playground, name each example's input keys to match that prompt's template variables.",
  inputSchema: createDatasetInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

export const patchDatasetOperation = defineUiOperation({
  name: "dataset.patch",
  description:
    "Edit the dataset the user is viewing — its name, description, and/or metadata. Only the " +
    "fields you pass are changed; omitted fields are left as they are. Does not change the " +
    "dataset's rows. Dataset names are unique; a duplicate name fails. Requires a dataset to " +
    "be in view.",
  inputSchema: patchDatasetInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

export const deleteDatasetOperation = defineUiOperation({
  name: "dataset.delete",
  description:
    "Permanently delete the dataset the user is viewing, including all of its rows, split " +
    "associations, experiments, and history. This is destructive and cannot be undone. Only " +
    "call it when the user has clearly asked to delete this dataset. Requires a dataset to be " +
    "in view.",
  inputSchema: deleteDatasetInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

export const addDatasetExamplesOperation = defineUiOperation({
  name: "dataset.examples.add",
  description:
    "Append one or more new examples to the dataset the user is currently viewing. Each " +
    "example has an input object and optional output and metadata objects. This adds rows to " +
    "the dataset in view; it does not create a new dataset or edit existing rows. Match the " +
    "shape of the dataset's existing rows, and pass input/output/metadata as JSON objects, " +
    "not strings.",
  inputSchema: addDatasetExamplesInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

export const patchDatasetExamplesOperation = defineUiOperation({
  name: "dataset.examples.patch",
  description:
    "Edit existing rows of the dataset the user is viewing. Each patch targets a row by id " +
    "and updates its input, output, and/or metadata; omitted fields on a patch are left " +
    "unchanged. This creates a new dataset version. Get row ids from the " +
    "list_dataset_examples tool. To add rows use dataset.examples.add; to remove rows use " +
    "dataset.examples.delete.",
  inputSchema: patchDatasetExamplesInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

export const deleteDatasetExamplesOperation = defineUiOperation({
  name: "dataset.examples.delete",
  description:
    "Remove rows from the dataset the user is viewing, by row id. This creates a new dataset " +
    "version that no longer contains those rows. Get row ids from the list_dataset_examples " +
    "tool.",
  inputSchema: deleteDatasetExamplesInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

export const addSpansToDatasetOperation = defineUiOperation({
  name: "dataset.addSpans",
  description:
    "Add the span the user is viewing (or specific spans by id) to a dataset, identified by " +
    "dataset name. Each span becomes a new dataset row built from the span's input, output, " +
    "and metadata. The dataset must already exist; resolve it by name with the list_datasets " +
    "tool, or create it with dataset.create first. By default the span in view is added; pass " +
    "spanIds to add other spans.",
  inputSchema: addSpansToDatasetInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

/** All dataset write operations, for catalog assembly and root registration. */
export const datasetWriteOperations: UiOperationDescriptor[] = [
  createDatasetOperation,
  patchDatasetOperation,
  deleteDatasetOperation,
  addDatasetExamplesOperation,
  patchDatasetExamplesOperation,
  deleteDatasetExamplesOperation,
  addSpansToDatasetOperation,
];
