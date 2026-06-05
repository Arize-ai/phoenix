import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { SET_DATASET_EVALUATOR_SELECTION_TOOL_NAME } from "./constants";
import { parseSetDatasetEvaluatorSelectionInput } from "./parsers";
import type { SetDatasetEvaluatorSelectionInput } from "./types";

/**
 * Replaces the dataset-backed playground's applied evaluator set with exactly
 * the requested ids. Delegates to the client action the mounted
 * `PlaygroundDatasetSection` registers, which re-resolves ids against the live
 * roster before applying.
 */
export const setDatasetEvaluatorSelectionAgentTool =
  defineClientActionTool<SetDatasetEvaluatorSelectionInput>({
    name: SET_DATASET_EVALUATOR_SELECTION_TOOL_NAME,
    parseInput: parseSetDatasetEvaluatorSelectionInput,
    invalidInputErrorText: `Invalid ${SET_DATASET_EVALUATOR_SELECTION_TOOL_NAME} input. Expected { datasetEvaluatorIds: string[] }.`,
    notMountedErrorText:
      "The dataset-backed playground is not mounted; cannot set the evaluator selection.",
    defaultSuccessOutput: "Dataset evaluator selection updated.",
  });
