import type { EvaluatorItem } from "@phoenix/components/evaluators/EvaluatorSelectMenuItem";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import { parseSetDatasetEvaluatorSelectionInput } from "./parsers";

const MAX_ECHOED_NAME_LENGTH = 120;

/** Bound a user-controlled evaluator name before echoing it back to the model. */
function boundName(name: string): string {
  return name.length > MAX_ECHOED_NAME_LENGTH
    ? `${name.slice(0, MAX_ECHOED_NAME_LENGTH)}…`
    : name;
}

/**
 * Replace the playground's applied dataset evaluators with exactly the requested
 * set. Requested ids are re-resolved against the live roster at apply time, so a
 * since-deleted id is reported as unknown rather than silently applied.
 */
export function createSetDatasetEvaluatorSelectionClientAction({
  getEvaluators,
  setSelectedDatasetEvaluatorIds,
}: {
  getEvaluators: () => EvaluatorItem[];
  setSelectedDatasetEvaluatorIds: (ids: string[]) => void;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseSetDatasetEvaluatorSelectionInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid set_dataset_evaluator_selection input.",
      };
    }

    const evaluatorsById = new Map(
      getEvaluators().map((evaluator) => [evaluator.id, evaluator])
    );
    const requestedIds = Array.from(new Set(parsed.datasetEvaluatorIds));
    const unknownIds = requestedIds.filter((id) => !evaluatorsById.has(id));
    if (unknownIds.length > 0) {
      return {
        ok: false,
        error:
          `These evaluator ids are not on the dataset (they may have been ` +
          `deleted): ${unknownIds.join(", ")}. Re-check the roster and retry.`,
      };
    }

    setSelectedDatasetEvaluatorIds(requestedIds);

    const applied = requestedIds.map((id) => {
      const evaluator = evaluatorsById.get(id)!;
      return { datasetEvaluatorId: id, name: boundName(evaluator.name) };
    });
    return {
      ok: true,
      output: JSON.stringify(
        {
          status: "updated",
          applied,
          message: `Applied ${applied.length} evaluator${applied.length === 1 ? "" : "s"} to the dataset playground.`,
        },
        null,
        2
      ),
    };
  };
}
