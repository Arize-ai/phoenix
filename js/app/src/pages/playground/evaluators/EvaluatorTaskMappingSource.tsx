import { useEffect } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import { EVALUATOR_MAPPING_SOURCE_DEFAULT } from "@phoenix/store/evaluatorStore";

import type { EvaluatorTaskMappingSourceQuery } from "./__generated__/EvaluatorTaskMappingSourceQuery.graphql";
import { createEvaluatorMappingSource } from "./evaluatorResults";

/**
 * Binds the editor's mapping sample to the first example of the dataset the
 * page is on, in the shape a run hands the evaluator: the example's output
 * is what is judged, `reference` starts empty, and the annotations holding
 * expected outputs are left out. So the Input mapping tab offers the paths a
 * run will resolve. Without a dataset, or with an empty one, the store's
 * dataset default stands in.
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
                    input
                    output
                    metadata
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
