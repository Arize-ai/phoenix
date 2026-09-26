import { useEffect } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import { EVALUATOR_MAPPING_SOURCE_DEFAULT } from "@phoenix/store/evaluatorStore";

import type { EvaluatorTaskMappingSourceQuery } from "./__generated__/EvaluatorTaskMappingSourceQuery.graphql";
import { createEvaluatorMappingSource } from "./evaluatorResults";

/**
 * Binds the editor's mapping sample to the first example of the dataset the
 * page is on, in the shape a run hands the evaluator: the example revision
 * itself, `input`, `output` and `metadata`, as the span it may have been
 * converted from. So the Input mapping tab offers exactly the paths a run
 * resolves here and online. Without a dataset, or with an empty one, the
 * store's dataset default stands in.
 */
export function EvaluatorTaskMappingSource({
  datasetId,
  splitIds,
}: {
  datasetId: string | null;
  splitIds?: string[];
}) {
  const store = useEvaluatorStoreInstance();

  const data = useLazyLoadQuery<EvaluatorTaskMappingSourceQuery>(
    graphql`
      query EvaluatorTaskMappingSourceQuery(
        $datasetId: ID!
        $splitIds: [ID!]
        $hasDataset: Boolean!
      ) {
        dataset: node(id: $datasetId) @include(if: $hasDataset) {
          ... on Dataset {
            examples(first: 1, splitIds: $splitIds) {
              edges {
                example: node {
                  revision {
                    evaluationContext
                  }
                }
              }
            }
          }
        }
      }
    `,
    {
      datasetId: datasetId ?? "",
      splitIds: splitIds ?? null,
      hasDataset: datasetId != null,
    }
  );

  const revision = data.dataset?.examples?.edges[0]?.example.revision ?? null;

  useEffect(() => {
    store.getState().setEvaluatorMappingSource({
      grain: "dataset",
      source: revision
        ? createEvaluatorMappingSource(revision)
        : EVALUATOR_MAPPING_SOURCE_DEFAULT,
    });
  }, [store, revision]);

  return null;
}
