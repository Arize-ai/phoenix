import type { EvaluatorItem } from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import { parseReadDatasetEvaluatorDefinitionInput } from "./parsers";
import {
  type DatasetEvaluatorDefinition,
  readDatasetEvaluatorDefinition,
} from "./readDatasetEvaluatorDefinition";

export function createReadDatasetEvaluatorDefinitionClientAction({
  datasetId,
  getEvaluators,
}: {
  datasetId: string;
  getEvaluators: () => EvaluatorItem[];
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseReadDatasetEvaluatorDefinitionInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid read_dataset_evaluator_definition input.",
      };
    }

    const evaluatorIds = new Set(
      getEvaluators().map((evaluator) => evaluator.id)
    );
    const requestedIds = Array.from(new Set(parsed.datasetEvaluatorIds));
    const unknownIds = requestedIds.filter((id) => !evaluatorIds.has(id));
    if (unknownIds.length > 0) {
      return {
        ok: false,
        error:
          `These evaluator ids are not on the dataset (they may have been ` +
          `deleted): ${unknownIds.join(", ")}. Re-check the roster and retry.`,
      };
    }

    const definitions: DatasetEvaluatorDefinition[] = [];
    for (const datasetEvaluatorId of requestedIds) {
      const result = await readDatasetEvaluatorDefinition({
        datasetId,
        datasetEvaluatorId,
      });
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      definitions.push(result.definition);
    }

    return {
      ok: true,
      output: JSON.stringify(
        { datasetEvaluatorDefinitions: definitions },
        null,
        2
      ),
    };
  };
}
