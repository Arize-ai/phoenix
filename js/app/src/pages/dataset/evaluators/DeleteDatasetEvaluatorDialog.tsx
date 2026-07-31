import { graphql, useMutation } from "react-relay";

import { DeleteEvaluatorDialog } from "@phoenix/components/evaluators/DeleteEvaluatorDialog";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { DeleteDatasetEvaluatorDialogMutation } from "./__generated__/DeleteDatasetEvaluatorDialogMutation.graphql";

export type DeleteDatasetEvaluatorDialogProps = {
  datasetEvaluatorId: string;
  evaluatorName: string;
  evaluatorKind: "LLM" | "CODE" | "BUILTIN";
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onDeleted?: () => void;
  updateConnectionIds?: string[];
};

export function DeleteDatasetEvaluatorDialog({
  datasetEvaluatorId,
  evaluatorName,
  evaluatorKind,
  isOpen,
  onOpenChange,
  onDeleted,
  updateConnectionIds = [],
}: DeleteDatasetEvaluatorDialogProps) {
  const [commitDelete, isDeleting] =
    useMutation<DeleteDatasetEvaluatorDialogMutation>(graphql`
      mutation DeleteDatasetEvaluatorDialogMutation(
        $input: DeleteDatasetEvaluatorsInput!
        $connectionIds: [ID!]!
      ) {
        deleteDatasetEvaluators(input: $input) {
          datasetEvaluatorIds @deleteEdge(connections: $connectionIds)
        }
      }
    `);
  return (
    <DeleteEvaluatorDialog
      evaluatorName={evaluatorName}
      evaluatorKind={evaluatorKind}
      target="dataset"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
      isDeleting={isDeleting}
      onDelete={({ deleteAssociatedPrompt }) =>
        new Promise<void>((resolve, reject) => {
          commitDelete({
            variables: {
              input: {
                datasetEvaluatorIds: [datasetEvaluatorId],
                deleteAssociatedPrompt,
              },
              connectionIds: updateConnectionIds,
            },
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
        })
      }
    />
  );
}
