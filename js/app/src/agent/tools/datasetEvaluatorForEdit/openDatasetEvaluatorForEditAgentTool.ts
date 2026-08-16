import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { OPEN_DATASET_EVALUATOR_FOR_EDIT_TOOL_NAME } from "./constants";
import { parseOpenDatasetEvaluatorForEditInput } from "./parsers";
import type { OpenDatasetEvaluatorForEditInput } from "./types";

export const openDatasetEvaluatorForEditAgentTool =
  defineClientActionTool<OpenDatasetEvaluatorForEditInput>({
    name: OPEN_DATASET_EVALUATOR_FOR_EDIT_TOOL_NAME,
    parseInput: parseOpenDatasetEvaluatorForEditInput,
    invalidInputErrorText: `Invalid ${OPEN_DATASET_EVALUATOR_FOR_EDIT_TOOL_NAME} input. Expected { datasetEvaluatorId: string }.`,
    notMountedErrorText:
      "The dataset-backed playground is not mounted; cannot open the evaluator for edit.",
    defaultSuccessOutput: "Evaluator opened for editing.",
  });
