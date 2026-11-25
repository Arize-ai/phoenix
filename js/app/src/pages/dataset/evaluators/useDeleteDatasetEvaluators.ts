import { graphql, useMutation, useRelayEnvironment } from "react-relay";

import type { useDeleteDatasetEvaluatorsMutation } from "@phoenix/pages/dataset/evaluators/__generated__/useDeleteDatasetEvaluatorsMutation.graphql";
import { refetchEvaluatorCounts } from "@phoenix/pages/evaluators/refetchEvaluatorCounts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

/**
 * Deletes dataset evaluators and removes them from the given connections.
 *
 * @returns `deleteDatasetEvaluators`, which resolves once the evaluators are
 * deleted and rejects with the server's error messages, and `isDeleting`.
 */
export function useDeleteDatasetEvaluators() {
  const environment = useRelayEnvironment();
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
            dataset: node(id: $datasetId) @include(if: $hasDataset) {
              ... on Dataset {
                evaluatorCount
              }
            }
          }
        }
      }
    `);
  const deleteDatasetEvaluators = ({
    datasetEvaluatorIds,
    deleteAssociatedPromptOrDecision,
    connectionIds = [],
    datasetId,
    refetchCounts = true,
  }: {
    datasetEvaluatorIds: ReadonlyArray<string>;
    deleteAssociatedPromptOrDecision: boolean;
    connectionIds?: ReadonlyArray<string>;
    /** The dataset every evaluator belongs to, whose count is refreshed. */
    datasetId?: string;
    /**
     * Refetches the evaluator counts once deleted. Pass false when the
     * caller refetches them after several deletes.
     */
    refetchCounts?: boolean;
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
        onCompleted: (_response, errors) => {
          if (errors?.length) {
            reject(new Error(errors.map(({ message }) => message).join("\n")));
            return;
          }
          if (refetchCounts) {
            refetchEvaluatorCounts({ environment });
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
    });
  return { deleteDatasetEvaluators, isDeleting };
}
