import { graphql, useMutation, useRelayEnvironment } from "react-relay";

import { DeleteEvaluatorDialog } from "@phoenix/components/evaluators/DeleteEvaluatorDialog";
import type { DeleteProjectEvaluatorDialogMutation } from "@phoenix/pages/project/evaluators/__generated__/DeleteProjectEvaluatorDialogMutation.graphql";
import { refetchProjectEvaluators } from "@phoenix/pages/project/evaluators/refetchProjectEvaluators";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export function DeleteProjectEvaluatorDialog({
  projectEvaluatorId,
  projectId,
  evaluatorName,
  evaluatorKind,
  isOpen,
  onOpenChange,
}: {
  projectEvaluatorId: string;
  projectId: string;
  evaluatorName: string;
  evaluatorKind: "LLM" | "CODE" | "BUILTIN";
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const environment = useRelayEnvironment();
  const [commitDelete, isDeleting] =
    useMutation<DeleteProjectEvaluatorDialogMutation>(graphql`
      mutation DeleteProjectEvaluatorDialogMutation(
        $input: DeleteProjectEvaluatorsInput!
      ) {
        deleteProjectEvaluators(input: $input) {
          projectEvaluatorIds
        }
      }
    `);
  return (
    <DeleteEvaluatorDialog
      evaluatorName={evaluatorName}
      evaluatorKind={evaluatorKind}
      target="project"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDeleting={isDeleting}
      onDelete={({ deleteAssociatedPrompt }) =>
        new Promise<void>((resolve, reject) => {
          commitDelete({
            variables: {
              input: {
                projectEvaluatorIds: [projectEvaluatorId],
                deleteAssociatedPrompt,
              },
            },
            onCompleted: (_response, errors) => {
              if (errors?.length) {
                reject(
                  new Error(errors.map(({ message }) => message).join("\n"))
                );
                return;
              }
              void refetchProjectEvaluators({ environment, projectId }).then(
                () => resolve(),
                reject
              );
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
        })
      }
    />
  );
}
