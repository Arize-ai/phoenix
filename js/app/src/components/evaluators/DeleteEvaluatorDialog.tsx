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
  onDelete: (options: {
    deleteUnusedPromptOrDecision: boolean;
  }) => Promise<void>;
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
  const [wasOpen, setWasOpen] = useState(Boolean(isOpen));
  const [openGeneration, setOpenGeneration] = useState(0);
  if (Boolean(isOpen) !== wasOpen) {
    setWasOpen(Boolean(isOpen));
    if (isOpen) {
      setOpenGeneration((generation) => generation + 1);
    }
  }
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal size="S">
        <Dialog>
          {({ close }) => (
            <DeleteEvaluatorDialogBody
              key={`${evaluatorKind}:${evaluatorName}:${openGeneration}`}
              evaluatorName={evaluatorName}
              evaluatorKind={evaluatorKind}
              target={target}
              isDeleting={isDeleting}
              onDelete={onDelete}
              onDeleted={onDeleted}
              onClose={close}
            />
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function DeleteEvaluatorDialogBody({
  evaluatorName,
  evaluatorKind,
  target,
  onDeleted,
  isDeleting,
  onDelete,
  onClose,
}: Omit<DeleteEvaluatorDialogProps, "isOpen" | "onOpenChange"> & {
  onClose: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const associatedLabel =
    evaluatorKind === "LLM"
      ? "prompt"
      : evaluatorKind === "DECISION"
        ? "decision"
        : null;
  const [deleteUnusedPromptOrDecision, setDeleteUnusedPromptOrDecision] =
    useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleDelete = () => {
    setError(null);
    startTransition(() => {
      void onDelete({
        deleteUnusedPromptOrDecision:
          associatedLabel !== null && deleteUnusedPromptOrDecision,
      })
        .then(() => {
          notifySuccess({
            title: "Evaluator removed",
            message: `Evaluator “${evaluatorName}” was removed from this ${target}.`,
          });
          onDeleted?.();
          onClose();
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
            Remove “{evaluatorName}” from this {target}. Its evaluation traces
            are deleted with it.
            {evaluatorKind === "BUILTIN"
              ? " The built-in evaluator remains available elsewhere."
              : " The evaluator is deleted only if it isn't used anywhere else."}
          </Text>
          {associatedLabel !== null ? (
            <Checkbox
              isSelected={deleteUnusedPromptOrDecision}
              onChange={setDeleteUnusedPromptOrDecision}
            >
              Delete associated {associatedLabel}
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
          <Button size="S" variant="default" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="S"
            onPress={handleDelete}
            isDisabled={isDeleting}
            leadingVisual={
              <Icon svg={isDeleting ? <Icons.Loading /> : <Icons.Trash />} />
            }
          >
            Delete evaluator
          </Button>
        </Flex>
      </View>
    </DialogContent>
  );
}
