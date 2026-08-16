import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { READ_DATASET_EVALUATOR_DEFINITION_TOOL_NAME } from "./constants";
import { parseReadDatasetEvaluatorDefinitionInput } from "./parsers";
import type { ReadDatasetEvaluatorDefinitionInput } from "./types";

export const readDatasetEvaluatorDefinitionAgentTool =
  defineClientActionTool<ReadDatasetEvaluatorDefinitionInput>({
    name: READ_DATASET_EVALUATOR_DEFINITION_TOOL_NAME,
    parseInput: parseReadDatasetEvaluatorDefinitionInput,
    invalidInputErrorText: `Invalid ${READ_DATASET_EVALUATOR_DEFINITION_TOOL_NAME} input. Expected { datasetEvaluatorIds: string[] } (1-5 ids).`,
    notMountedErrorText:
      "The dataset-backed playground is not mounted; cannot read evaluator definitions.",
    defaultSuccessOutput: "Evaluator definitions read.",
  });
