import { loadDatasetInputSchema } from "@phoenix/agent/tools/playgroundLoadDataset/schemas";

import type { UIOperationDescriptor } from "../types";
import { defineUIOperation } from "../types";
import { PLAYGROUND_ROUTE_HINT } from "./playgroundRouteHints";

/**
 * The catalog entry replacing the `load_dataset` client-action tool. Loading
 * a dataset is an approval operation: the browser stages the dataset switch
 * and the promise resolves only after the user accepts or rejects it. The
 * input schema is reused from the existing tool module.
 */
export const loadDatasetOperation = defineUIOperation({
  name: "playground.dataset.load",
  description:
    "Load a dataset into the currently mounted playground, optionally scoped to a single " +
    "split, so the tasks run over the dataset's examples. Use this when the user asks to " +
    "load, open, switch to, run against, or run an experiment over a dataset (or one split " +
    "of it) in the playground. Evaluator tasks always run over the loaded dataset and " +
    "are saved onto it, so load one before running or saving them. This only switches " +
    "the playground's dataset selection; it does not edit prompts, set variables, or run " +
    "the playground.",
  inputSchema: loadDatasetInputSchema,
  operationKind: "approval",
  requireSession: true,
  UIBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
  defaultSuccessOutput: "Dataset loaded into the playground.",
  availability: {
    routeHint: PLAYGROUND_ROUTE_HINT,
  },
});

/** All playground dataset-loading operations, for catalog assembly. */
export const playgroundLoadDatasetOperations: UIOperationDescriptor[] = [
  loadDatasetOperation,
];
