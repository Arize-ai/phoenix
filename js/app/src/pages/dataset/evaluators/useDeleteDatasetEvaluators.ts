import { useCallback } from "react";
import { graphql, useMutation } from "react-relay";

import type { useDeleteDatasetEvaluatorsMutation } from "@phoenix/pages/dataset/evaluators/__generated__/useDeleteDatasetEvaluatorsMutation.graphql";
import { updateRootEvaluatorCounts } from "@phoenix/pages/evaluators/updateRootEvaluatorCounts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

/**
 * Deletes dataset evaluators and removes them from the given connections.
 *
 * @returns `deleteDatasetEvaluators`, which resolves once the evaluators are
 * deleted and rejects with the server's error messages, and `isDeleting`.
 */
export function useDeleteDatasetEvaluators() {
  const [commitDelete, isDeleting] =
    useMutation<useDeleteDatasetEvaluatorsMutation>(graphql`
      mutation useDeleteDatasetEvaluatorsMutation(
        $input: DeleteDatasetEvaluatorsInput!
        $connectionIds: [ID!]!
        $datasetId: ID!
        $hasDataset: Boolean!
      ) {
        deleteDatasetEvaluators(input: $input) {
          datasetEvaluatorIds @deleteEdge(connections: $connectionIds)
          query {
            projectEvaluatorCount
            datasetEvaluatorCount
            dataset: node(id: $datasetId) @include(if: $hasDataset) {
              ... on Dataset {
                evaluatorCount
              }
            }
          }
        }
      }
    `);
  const deleteDatasetEvaluators = useCallback(
    ({
      datasetEvaluatorIds,
      deleteAssociatedPromptOrDecision,
      connectionIds = [],
      datasetId,
    }: {
      datasetEvaluatorIds: ReadonlyArray<string>;
      deleteAssociatedPromptOrDecision: boolean;
      connectionIds?: ReadonlyArray<string>;
      /** The dataset every evaluator belongs to, whose count is refreshed. */
      datasetId?: string;
    }) =>
      new Promise<void>((resolve, reject) => {
        commitDelete({
          variables: {
            input: {
              datasetEvaluatorIds,
              deleteAssociatedPromptOrDecision,
            },
            connectionIds,
            datasetId: datasetId ?? "",
            hasDataset: datasetId != null,
          },
          updater: (store) =>
            updateRootEvaluatorCounts(store, "deleteDatasetEvaluators"),
          onCompleted: (_response, errors) => {
            if (errors?.length) {
              reject(
                new Error(errors.map(({ message }) => message).join("\n"))
              );
              return;
            }
            resolve();
          },
          onError: (mutationError) =>
            reject(
              new Error(
                getErrorMessagesFromRelayMutationError(mutationError)?.join(
                  "\n"
                ) ?? mutationError.message
              )
            ),
        });
      }),
    [commitDelete]
  );
  return { deleteDatasetEvaluators, isDeleting };
}
