import { useCallback } from "react";
import { graphql, useMutation, useRelayEnvironment } from "react-relay";

import { refetchEvaluatorCounts } from "@phoenix/pages/evaluators/refetchEvaluatorCounts";
import type { useDeleteProjectEvaluatorsMutation } from "@phoenix/pages/project/evaluators/__generated__/useDeleteProjectEvaluatorsMutation.graphql";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

/**
 * Deletes project evaluators. Lists showing them must be refetched.
 *
 * @returns `deleteProjectEvaluators`, which resolves once the evaluators are
 * deleted and rejects with the server's error messages, and `isDeleting`.
 */
export function useDeleteProjectEvaluators() {
  const environment = useRelayEnvironment();
  const [commitDelete, isDeleting] =
    useMutation<useDeleteProjectEvaluatorsMutation>(graphql`
      mutation useDeleteProjectEvaluatorsMutation(
        $input: DeleteProjectEvaluatorsInput!
      ) {
        deleteProjectEvaluators(input: $input) {
          projectEvaluatorIds
        }
      }
    `);
  const deleteProjectEvaluators = useCallback(
    ({
      projectEvaluatorIds,
      deleteAssociatedPromptOrDecision,
      refetchCounts = true,
    }: {
      projectEvaluatorIds: ReadonlyArray<string>;
      deleteAssociatedPromptOrDecision: boolean;
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
              projectEvaluatorIds,
              deleteAssociatedPromptOrDecision,
            },
          },
          onCompleted: (_response, errors) => {
            if (errors?.length) {
              reject(
                new Error(errors.map(({ message }) => message).join("\n"))
              );
              return;
            }
            if (refetchCounts) {
              // The delete succeeded; a stale count corrects itself on the
              // next visit, so a failed refresh isn't reported.
              void refetchEvaluatorCounts({ environment }).catch(() => {});
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
    [commitDelete, environment]
  );
  return { deleteProjectEvaluators, isDeleting };
}
