import { graphql, useLazyLoadQuery } from "react-relay";

import type { PlaygroundEvaluatorTaskSource } from "@phoenix/store/playground";

import type { useEvaluatorTaskSaveTargetQuery } from "./__generated__/useEvaluatorTaskSaveTargetQuery.graphql";
import type { EvaluatorSaveTarget } from "./evaluatorSaveTarget";
import { getEvaluatorSaveTarget } from "./evaluatorSaveTarget";

/**
 * What Save will do for the task, from the bindings of the evaluator it was
 * loaded from and the dataset the page is on, with the names the loaded
 * evaluator and binding go by. Read from the Relay store when it can be: the
 * save mutations return the evaluator's bindings, so a save moves the target
 * from create to update without a refetch.
 */
export function useEvaluatorTaskSaveTarget({
  source,
  datasetId,
}: {
  source: PlaygroundEvaluatorTaskSource;
  datasetId: string | null;
}): {
  target: EvaluatorSaveTarget;
  /**
   * The names the loaded evaluator is saved under: the shared evaluator's
   * and its binding's. A draft still named one of them is unchanged in name.
   */
  savedNames: string[];
} {
  const data = useLazyLoadQuery<useEvaluatorTaskSaveTargetQuery>(
    graphql`
      query useEvaluatorTaskSaveTargetQuery(
        $evaluatorId: ID!
        $hasEvaluator: Boolean!
        $datasetEvaluatorId: ID!
        $hasDatasetEvaluator: Boolean!
      ) {
        evaluator: node(id: $evaluatorId) @include(if: $hasEvaluator) {
          ... on Evaluator {
            id
            name
            kind
            datasetEvaluators {
              id
              dataset {
                id
              }
            }
          }
        }
        datasetEvaluator: node(id: $datasetEvaluatorId)
          @include(if: $hasDatasetEvaluator) {
          ... on DatasetEvaluator {
            id
            name
            dataset {
              id
            }
          }
        }
      }
    `,
    {
      evaluatorId: source.evaluatorId ?? "",
      hasEvaluator: source.evaluatorId != null,
      datasetEvaluatorId: source.datasetEvaluatorId ?? "",
      hasDatasetEvaluator: source.datasetEvaluatorId != null,
    },
    { fetchPolicy: "store-or-network" }
  );

  const evaluator = data.evaluator;
  const binding = data.datasetEvaluator;

  const target = getEvaluatorSaveTarget({
    datasetId,
    source:
      evaluator?.id && evaluator.kind
        ? {
            id: evaluator.id,
            kind: evaluator.kind,
            datasetEvaluators: evaluator.datasetEvaluators ?? [],
          }
        : null,
    selectedDatasetEvaluator:
      binding?.id && binding.dataset
        ? { id: binding.id, datasetId: binding.dataset.id }
        : null,
  });

  const savedNames = [evaluator?.name, binding?.name].flatMap((name) =>
    name ? [name] : []
  );

  return { target, savedNames };
}
