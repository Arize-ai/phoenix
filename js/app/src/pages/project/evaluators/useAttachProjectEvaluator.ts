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
  const attach = (variables: TMutation["variables"]) => {
    setError(undefined);
    commit({
      variables,
      onCompleted: (_response, errors) => {
        if (errors?.length) {
          setError(errors.map(({ message }) => message).join("\n"));
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
        void refetchProjectEvaluators({
          environment,
          projectId,
          timeRange: timeRangeISOStrings,
        })
          .then(onSuccess)
          .catch((refetchError: unknown) =>
            setError(
              refetchError instanceof Error
                ? refetchError.message
                : "Unable to refresh project evaluators"
            )
          );
      },
      onError: (mutationError) =>
        setError(
          getErrorMessagesFromRelayMutationError(mutationError)?.join("\n") ??
            mutationError.message
        ),
    });
  };
  return { attach, isAttaching, error };
}
