import { useCallback } from "react";
import { graphql, useMutation } from "react-relay";

import { updateRootEvaluatorCounts } from "@phoenix/pages/evaluators/updateRootEvaluatorCounts";
import type { useDeleteProjectEvaluatorsMutation } from "@phoenix/pages/project/evaluators/__generated__/useDeleteProjectEvaluatorsMutation.graphql";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

/**
 * Deletes project evaluators. Lists showing them must be refetched.
 *
 * @returns `deleteProjectEvaluators`, which resolves once the evaluators are
 * deleted and rejects with the server's error messages, and `isDeleting`.
 */
export function useDeleteProjectEvaluators() {
  const [commitDelete, isDeleting] =
    useMutation<useDeleteProjectEvaluatorsMutation>(graphql`
      mutation useDeleteProjectEvaluatorsMutation(
        $input: DeleteProjectEvaluatorsInput!
      ) {
        deleteProjectEvaluators(input: $input) {
          projectEvaluatorIds
          query {
            projectEvaluatorCount
            datasetEvaluatorCount
          }
        }
      }
    `);
  const deleteProjectEvaluators = useCallback(
    ({
      projectEvaluatorIds,
      deleteAssociatedPromptOrDecision,
    }: {
      projectEvaluatorIds: ReadonlyArray<string>;
      deleteAssociatedPromptOrDecision: boolean;
    }) =>
      new Promise<void>((resolve, reject) => {
        commitDelete({
          variables: {
            input: {
              projectEvaluatorIds,
              deleteAssociatedPromptOrDecision,
            },
          },
          updater: (store) =>
            updateRootEvaluatorCounts(store, "deleteProjectEvaluators"),
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
  return { deleteProjectEvaluators, isDeleting };
}
