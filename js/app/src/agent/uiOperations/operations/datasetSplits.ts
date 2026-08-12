import {
  createDatasetSplitInputSchema,
  deleteDatasetSplitsInputSchema,
  patchDatasetSplitInputSchema,
  setDatasetExampleSplitsInputSchema,
} from "@phoenix/agent/tools/datasetSplits/schemas";

import type { UiOperationDescriptor } from "../types";
import { defineUiOperation } from "../types";

/**
 * Catalog entries replacing the standalone dataset split write tools
 * (`create_dataset_split`, `patch_dataset_split`, `delete_dataset_splits`,
 * `set_dataset_example_splits`). Approval operations staged in the shared
 * dataset-approval card, registered at the app root; the split read tools
 * (`list_dataset_splits`, `list_splits`) remain standalone. Input schemas are
 * reused from the existing tool module; descriptions are ported from the
 * Python `DESCRIPTION`s with tool names rewritten to operation names.
 */

const APPROVAL_UI_BEHAVIOR = {
  autoOpen: true,
  scrollIntoViewOnMount: true,
} as const;

export const createDatasetSplitOperation = defineUiOperation({
  name: "dataset.split.create",
  description:
    "Create a new split, optionally seeded with rows from the dataset the user is viewing. A " +
    "split is a named slice of dataset rows (e.g. train/validation/test). Split names are " +
    "unique across this Phoenix instance; if the name is taken the call fails and you should " +
    "pick a different name. To put existing rows into a split that already exists, use " +
    "dataset.split.setExampleSplits instead.",
  inputSchema: createDatasetSplitInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

export const setDatasetExampleSplitsOperation = defineUiOperation({
  name: "dataset.split.setExampleSplits",
  description:
    "Assign rows of the dataset the user is viewing to one or more existing splits, by split " +
    "name. This SETS each row's splits to exactly the named splits — it replaces whatever " +
    "splits those rows were in. The splits must already exist on the dataset; to create a new " +
    "split use dataset.split.create. Get example ids from the list_dataset_examples tool and " +
    "split names from the list_dataset_splits tool.",
  inputSchema: setDatasetExampleSplitsInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

export const patchDatasetSplitOperation = defineUiOperation({
  name: "dataset.split.patch",
  description:
    "Edit an existing split of the dataset the user is viewing — its name, description, and/or " +
    "color — identified by its current name. Only the fields you pass are changed. Pass " +
    "description: null to clear the description; name and color cannot be cleared, only " +
    "replaced with a new non-empty value. Does not change which rows are in the split (use " +
    "dataset.split.setExampleSplits for that). Get the split's current name from the " +
    "list_dataset_splits tool. Split names are unique; a duplicate new name fails.",
  inputSchema: patchDatasetSplitInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

export const deleteDatasetSplitsOperation = defineUiOperation({
  name: "dataset.split.delete",
  description:
    "Delete splits, identified by name. This removes each split entirely (across the " +
    "instance); the dataset's rows themselves are not deleted, only their membership in these " +
    "splits. This cannot be undone. Get split names from the list_dataset_splits tool.",
  inputSchema: deleteDatasetSplitsInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

/** All dataset split operations, for catalog assembly and root registration. */
export const datasetSplitOperations: UiOperationDescriptor[] = [
  createDatasetSplitOperation,
  setDatasetExampleSplitsOperation,
  patchDatasetSplitOperation,
  deleteDatasetSplitsOperation,
];
