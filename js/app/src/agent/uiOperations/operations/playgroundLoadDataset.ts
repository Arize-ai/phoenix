import { loadDatasetInputSchema } from "@phoenix/agent/tools/playgroundLoadDataset/schemas";

import type { UiOperationDescriptor } from "../types";
import { defineUiOperation } from "../types";

/**
 * The catalog entry replacing the `load_dataset` client-action tool. Loading
 * a dataset is an approval operation: the browser stages the dataset switch
 * and the promise resolves only after the user accepts or rejects it. The
 * input schema is reused from the existing tool module; the description moves
 * here verbatim from the Python `DESCRIPTION`.
 */
export const loadDatasetOperation = defineUiOperation({
  name: "playground.dataset.load",
  description:
    "Load a dataset into the currently mounted playground, optionally scoped to a single " +
    "split, so the prompt runs over the dataset's examples. Use this when the user asks to " +
    "load, open, switch to, run against, or run an experiment over a dataset (or one split " +
    "of it) in the playground. This only switches the playground's dataset selection; it " +
    "does not edit prompts, set variables, or run the playground.",
  inputSchema: loadDatasetInputSchema,
  kind: "approval",
  requireSession: true,
  uiBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
  defaultSuccessOutput: "Dataset loaded into the playground.",
  availability: {
    routeHint: "the Prompt Playground page (a /playground route)",
  },
});

/** All playground dataset-loading operations, for catalog assembly. */
export const playgroundLoadDatasetOperations: UiOperationDescriptor[] = [
  loadDatasetOperation,
];
