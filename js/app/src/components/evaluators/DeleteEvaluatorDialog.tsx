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
import type { EvaluatorKind } from "@phoenix/types";

export type DeleteEvaluatorDialogProps = {
  evaluatorName: string;
  evaluatorKind: EvaluatorKind;
  target: "project" | "dataset";
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onDeleted?: () => void;
  isDeleting: boolean;
  onDelete: (options: { deleteAssociatedPromptOrDecision: boolean }) => Promise<void>;
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
  const [deleteAssociatedPromptOrDecision, setDeleteAssociatedPromptOrDecision] = useState(true);
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
        deleteAssociatedPromptOrDecision:
          (evaluatorKind === "LLM" || evaluatorKind === "DECISION") &&
          deleteAssociatedPromptOrDecision,
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
                {evaluatorKind === "LLM" || evaluatorKind === "DECISION" ? (
                  <Checkbox
                    isSelected={deleteAssociatedPromptOrDecision}
                    onChange={setDeleteAssociatedPromptOrDecision}
                  >
                    Delete associated {evaluatorKind === "LLM" ? "prompt" : "decision"}
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
