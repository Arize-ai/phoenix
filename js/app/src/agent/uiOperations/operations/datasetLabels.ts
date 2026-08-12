import {
  createDatasetLabelInputSchema,
  deleteDatasetLabelsInputSchema,
  setDatasetLabelsInputSchema,
} from "@phoenix/agent/tools/datasetLabels/schemas";

import type { UiOperationDescriptor } from "../types";
import { defineUiOperation } from "../types";

/**
 * Catalog entries replacing the standalone dataset label write tools
 * (`create_dataset_label`, `set_dataset_labels`, `delete_dataset_labels`).
 * Approval operations staged in the shared dataset-approval card, registered
 * at the app root; the label read tools (`list_dataset_labels`,
 * `list_labels`) remain standalone. Input schemas are reused from the
 * existing tool module; descriptions are ported from the Python
 * `DESCRIPTION`s with tool names rewritten to operation names.
 */

const APPROVAL_UI_BEHAVIOR = {
  autoOpen: true,
  scrollIntoViewOnMount: true,
} as const;

export const createDatasetLabelOperation = defineUiOperation({
  name: "dataset.label.create",
  description:
    "Create a new dataset label and, by default, attach it to the dataset the user is viewing. " +
    "A label is a tag used to organize and find datasets. Label names are unique across this " +
    "Phoenix instance; if the name is taken the call fails and you should pick a different " +
    "name. To attach a label that already exists, use dataset.label.set instead.",
  inputSchema: createDatasetLabelInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

export const setDatasetLabelsOperation = defineUiOperation({
  name: "dataset.label.set",
  description:
    "Set the labels on the dataset the user is viewing, by label name. This SETS the dataset's " +
    "labels to exactly the named labels — it replaces whatever labels were on it. The labels " +
    "must already exist; to create a new label use dataset.label.create. Get label names from " +
    "the list_dataset_labels tool.",
  inputSchema: setDatasetLabelsInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

export const deleteDatasetLabelsOperation = defineUiOperation({
  name: "dataset.label.delete",
  description:
    "Delete dataset labels, identified by name. This removes each label entirely (across the " +
    "instance), detaching it from every dataset it was on; the datasets themselves are not " +
    "deleted. This cannot be undone. To remove a label from this dataset without deleting the " +
    "label, use dataset.label.set. Get label names from the list_dataset_labels tool.",
  inputSchema: deleteDatasetLabelsInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: APPROVAL_UI_BEHAVIOR,
});

/** All dataset label operations, for catalog assembly and root registration. */
export const datasetLabelOperations: UiOperationDescriptor[] = [
  createDatasetLabelOperation,
  setDatasetLabelsOperation,
  deleteDatasetLabelsOperation,
];
