import { defineClientActionTool } from "@phoenix/agent/extensions/registry/defineClientActionTool";

import { OPEN_DATASET_EVALUATOR_FOR_EDIT_TOOL_NAME } from "./constants";
import { parseOpenDatasetEvaluatorForEditInput } from "./parsers";
import type { OpenDatasetEvaluatorForEditInput } from "./types";

/**
 * Opens an existing code or LLM evaluator's edit slideover by id. Delegates to
 * the client action the mounted `PlaygroundDatasetSection` registers, which
 * re-resolves the id against the live roster, rejects built-in / not-editable
 * targets and same-kind form collisions, and waits for the draft tools to mount.
 */
export const openDatasetEvaluatorForEditAgentTool =
  defineClientActionTool<OpenDatasetEvaluatorForEditInput>({
    name: OPEN_DATASET_EVALUATOR_FOR_EDIT_TOOL_NAME,
    parseInput: parseOpenDatasetEvaluatorForEditInput,
    invalidInputErrorText: `Invalid ${OPEN_DATASET_EVALUATOR_FOR_EDIT_TOOL_NAME} input. Expected { datasetEvaluatorId: string }.`,
    notMountedErrorText:
      "The dataset-backed playground is not mounted; cannot open the evaluator for edit.",
    defaultSuccessOutput: "Evaluator opened for editing.",
  });
