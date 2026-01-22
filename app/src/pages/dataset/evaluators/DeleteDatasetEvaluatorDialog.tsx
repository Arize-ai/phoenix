import { startTransition, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Dialog,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import { Checkbox } from "@phoenix/components/checkbox";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { DeleteDatasetEvaluatorDialogMutation } from "./__generated__/DeleteDatasetEvaluatorDialogMutation.graphql";

export type DeleteDatasetEvaluatorDialogProps = {
  datasetEvaluatorId: string;
  evaluatorName: string;
  evaluatorKind: "LLM" | "CODE";
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onDeleted?: () => void;
  /**
   * Connection IDs to update when the evaluator is deleted.
   * These are used by Relay to remove the deleted node from the connections.
   */
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
  const notifySuccess = useNotifySuccess();
  const [deleteAssociatedPrompt, setDeleteAssociatedPrompt] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [commitDelete, isCommittingDelete] =
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

  const handleDelete = useCallback(() => {
    setError(null);
    startTransition(() => {
      commitDelete({
        variables: {
          input: {
            datasetEvaluatorIds: [datasetEvaluatorId],
            deleteAssociatedPrompt:
              evaluatorKind === "LLM" && deleteAssociatedPrompt,
          },
          connectionIds: updateConnectionIds,
        },
        onCompleted: () => {
          notifySuccess({
            title: "Evaluator deleted",
            message: `Evaluator "${evaluatorName}" has been deleted.`,
          });
          onDeleted?.();
          onOpenChange?.(false);
        },
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          setError(formattedError?.[0] ?? error.message);
        },
      });
    });
  }, [
    commitDelete,
    datasetEvaluatorId,
    deleteAssociatedPrompt,
    evaluatorName,
    evaluatorKind,
    notifySuccess,
    onDeleted,
    onOpenChange,
    updateConnectionIds,
  ]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setError(null);
      }
      onOpenChange?.(open);
    },
    [onOpenChange]
  );

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal size="S">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Evaluator</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            <View padding="size-200">
              <Flex direction="column" gap="size-100">
                {error && <Alert variant="danger">{error}</Alert>}
                <Text color="danger">
                  {`Are you sure you want to delete evaluator "${evaluatorName}"? This action cannot be undone.`}
                </Text>
                {evaluatorKind === "LLM" && (
                  <Checkbox
                    isSelected={deleteAssociatedPrompt}
                    onChange={setDeleteAssociatedPrompt}
                  >
                    <Text>Delete associated prompt</Text>
                  </Checkbox>
                )}
              </Flex>
            </View>
            <View
              paddingEnd="size-200"
              paddingTop="size-100"
              paddingBottom="size-100"
              borderTopColor="light"
              borderTopWidth="thin"
            >
              <Flex direction="row" justifyContent="end" gap="size-100">
                <Button size="S" onPress={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="S"
                  onPress={() => {
                    handleDelete();
                  }}
                  isDisabled={isCommittingDelete}
                  leadingVisual={
                    <Icon
                      svg={
                        isCommittingDelete ? (
                          <Icons.LoadingOutline />
                        ) : (
                          <Icons.TrashOutline />
                        )
                      }
                    />
                  }
                >
                  Delete Evaluator
                </Button>
              </Flex>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
