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
import { useNotifySuccess } from "@phoenix/contexts";

export type DeleteEvaluatorDialogProps = {
  evaluatorName: string;
  evaluatorKind: "LLM" | "CODE" | "BUILTIN";
  target: "project" | "dataset";
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onDeleted?: () => void;
  isDeleting: boolean;
  onDelete: (options: { deleteAssociatedPrompt: boolean }) => Promise<void>;
};

export function DeleteEvaluatorDialog({
  evaluatorName,
  evaluatorKind,
  target,
  isOpen,
  onOpenChange,
  onDeleted,
  isDeleting,
  onDelete,
}: DeleteEvaluatorDialogProps) {
  const notifySuccess = useNotifySuccess();
  const [deleteAssociatedPrompt, setDeleteAssociatedPrompt] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        deleteAssociatedPrompt:
          evaluatorKind === "LLM" && deleteAssociatedPrompt,
      })
        .then(() => {
          notifySuccess({
            title: "Evaluator removed",
            message: `Evaluator “${evaluatorName}” was removed from this ${target}.`,
          });
          onDeleted?.();
          onOpenChange?.(false);
        })
        .catch((deleteError: unknown) => {
          setError(
            deleteError instanceof Error
              ? deleteError.message
              : "Unable to remove evaluator"
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
              <DialogTitle>Delete evaluator</DialogTitle>
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
                <Text>
                  Remove “{evaluatorName}” from this {target}. Its evaluation
                  traces are deleted with it.
                  {evaluatorKind === "BUILTIN"
                    ? " The built-in evaluator remains available elsewhere."
                    : " The evaluator is deleted only if it isn't used anywhere else."}
                </Text>
                {evaluatorKind === "LLM" ? (
                  <Checkbox
                    isSelected={deleteAssociatedPrompt}
                    onChange={setDeleteAssociatedPrompt}
                  >
                    Delete associated prompt
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
                  Delete evaluator
                </Button>
              </Flex>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
