import { startTransition, useState } from "react";

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
import { Checkbox } from "@phoenix/components/core/checkbox";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import {
  type EvaluatorToDelete,
  getDeleteAssociatedLabel,
  getDeleteEvaluatorsCopy,
} from "@phoenix/components/evaluators/deleteEvaluatorsCopy";
import { useNotifySuccess } from "@phoenix/contexts";

export type DeleteEvaluatorDialogProps = {
  /** The evaluators to remove; at least one. */
  evaluators: ReadonlyArray<EvaluatorToDelete>;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onDeleted?: () => void;
  isDeleting: boolean;
  onDelete: (options: {
    deleteAssociatedPromptOrDecision: boolean;
  }) => Promise<void>;
};

/**
 * Confirms deleting one or more evaluators.
 */
export function DeleteEvaluatorDialog({
  evaluators,
  isOpen,
  onOpenChange,
  onDeleted,
  isDeleting,
  onDelete,
}: DeleteEvaluatorDialogProps) {
  const notifySuccess = useNotifySuccess();
  const [deleteAssociated, setDeleteAssociated] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const copy = getDeleteEvaluatorsCopy(evaluators);
  const deleteAssociatedLabel = getDeleteAssociatedLabel(evaluators);
  const handleOpenChange = (nextIsOpen: boolean) => {
    if (nextIsOpen) {
      setError(null);
    }
    onOpenChange?.(nextIsOpen);
  };
  const handleDelete = () => {
    setError(null);
    startTransition(() => {
      void onDelete({
        deleteAssociatedPromptOrDecision:
          deleteAssociatedLabel != null && deleteAssociated,
      })
        .then(() => {
          notifySuccess({
            title: copy.successTitle,
            message: copy.successMessage,
          });
          onDeleted?.();
          onOpenChange?.(false);
        })
        .catch((deleteError: unknown) => {
          setError(
            deleteError instanceof Error
              ? deleteError.message
              : "Unable to delete evaluators"
          );
        });
    });
  };
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal size="S">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
            {error ? (
              <View paddingX="size-200" paddingTop="size-100">
                <Alert variant="danger" banner>
                  {error}
                </Alert>
              </View>
            ) : null}
            <View padding="size-200">
              <Flex direction="column" gap="size-100">
                <Text color="danger">{copy.description}</Text>
                {deleteAssociatedLabel ? (
                  <Checkbox
                    isSelected={deleteAssociated}
                    onChange={setDeleteAssociated}
                  >
                    {deleteAssociatedLabel}
                  </Checkbox>
                ) : null}
              </Flex>
            </View>
            <View
              paddingEnd="size-200"
              paddingTop="size-100"
              paddingBottom="size-100"
              borderTopColor="default"
              borderTopWidth="thin"
            >
              <Flex direction="row" justifyContent="end" gap="size-100">
                <Button
                  size="S"
                  variant="default"
                  onPress={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="S"
                  onPress={handleDelete}
                  isDisabled={isDeleting}
                  leadingVisual={
                    <Icon
                      svg={isDeleting ? <Icons.Loading /> : <Icons.Trash />}
                    />
                  }
                >
                  {copy.confirmLabel}
                </Button>
              </Flex>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
