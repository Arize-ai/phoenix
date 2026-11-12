import { useState } from "react";
import {
  ConnectionHandler,
  useMutation,
  useRelayEnvironment,
} from "react-relay";
import type { GraphQLTaggedNode, MutationParameters } from "relay-runtime";

import { useTimeRange } from "@phoenix/components/datetime";
import { PROJECT_EVALUATOR_GALLERY_CUSTOM_EVALUATORS_CONNECTION_KEY } from "@phoenix/pages/project/evaluators/projectEvaluatorGalleryConstants";
import { refetchProjectEvaluators } from "@phoenix/pages/project/evaluators/refetchProjectEvaluators";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export type AttachProjectEvaluatorResult<TResponse> =
  | { ok: true; response: TResponse }
  | { ok: false; error: string };

/**
 * Attaches an existing evaluator to a project: once the mutation lands, the
 * evaluator leaves the gallery's list and the project's evaluators refetch.
 */
export function useAttachProjectEvaluator<
  TMutation extends MutationParameters,
>({
  mutation,
  projectId,
  evaluatorId,
  onSuccess,
}: {
  mutation: GraphQLTaggedNode;
  projectId: string;
  evaluatorId: string;
  onSuccess: () => void;
}) {
  const environment = useRelayEnvironment();
  const { timeRangeISOStrings } = useTimeRange();
  const [commit, isAttaching] = useMutation<TMutation>(mutation);
  const [error, setError] = useState<string>();
  /**
   * Resolves once the evaluator is attached and the project's evaluators
   * refetched, or with the error the form shows, so PXI's attach can wait
   * for the outcome the button produces.
   */
  const attach = (
    variables: TMutation["variables"]
  ): Promise<AttachProjectEvaluatorResult<TMutation["response"]>> =>
    new Promise((resolve) => {
      const fail = (message: string) => {
        setError(message);
        resolve({ ok: false, error: message });
      };
      setError(undefined);
      commit({
        variables,
        onCompleted: (response, errors) => {
          if (errors?.length) {
            fail(errors.map(({ message }) => message).join("\n"));
            return;
          }
          environment.commitUpdate((relayStore) => {
            const galleryConnection = ConnectionHandler.getConnection(
              relayStore.getRoot(),
              PROJECT_EVALUATOR_GALLERY_CUSTOM_EVALUATORS_CONNECTION_KEY,
              { excludeProjectId: projectId }
            );
            if (galleryConnection) {
              ConnectionHandler.deleteNode(galleryConnection, evaluatorId);
            }
          });
          // The attach has landed: a failed refresh is the list's problem,
          // not the attach's, so it is shown without reporting a failure that
          // would invite a retry.
          void refetchProjectEvaluators({
            environment,
            projectId,
            timeRange: timeRangeISOStrings,
          })
            .then(() => {
              resolve({ ok: true, response });
              onSuccess();
            })
            .catch((refetchError: unknown) => {
              setError(
                `Attached, but the evaluator list could not refresh: ${
                  refetchError instanceof Error
                    ? refetchError.message
                    : "unknown error"
                }`
              );
              resolve({ ok: true, response });
            });
        },
        onError: (mutationError) =>
          fail(
            getErrorMessagesFromRelayMutationError(mutationError)?.join("\n") ??
              mutationError.message
          ),
      });
    });
  return { attach, isAttaching, error };
}
