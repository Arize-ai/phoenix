import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { SET_DATASET_EVALUATOR_SELECTION_TOOL_NAME } from "./constants";
import { parseSetDatasetEvaluatorSelectionInput } from "./parsers";
import type { SetDatasetEvaluatorSelectionInput } from "./types";

export const setDatasetEvaluatorSelectionAgentTool =
  defineClientActionTool<SetDatasetEvaluatorSelectionInput>({
    name: SET_DATASET_EVALUATOR_SELECTION_TOOL_NAME,
    parseInput: parseSetDatasetEvaluatorSelectionInput,
    invalidInputErrorText: `Invalid ${SET_DATASET_EVALUATOR_SELECTION_TOOL_NAME} input. Expected { datasetEvaluatorIds: string[] }.`,
    notMountedErrorText:
      "The dataset-backed playground is not mounted; cannot set the evaluator selection.",
    defaultSuccessOutput: "Dataset evaluator selection updated.",
  });
