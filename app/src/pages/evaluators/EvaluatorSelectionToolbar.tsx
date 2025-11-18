import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  Flex,
  Icon,
  IconButton,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  Toolbar,
  Tooltip,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { FloatingToolbarContainer } from "@phoenix/components/toolbar/FloatingToolbarContainer";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

interface SelectedEvaluator {
  id: string;
  name: string;
}

type EvaluatorSelectionToolbarProps = {
  selectedEvaluators: SelectedEvaluator[];
  onClearSelection: () => void;
  onEvaluatorsDeleted: () => void;
};

export function EvaluatorSelectionToolbar(
  props: EvaluatorSelectionToolbarProps
) {
  const { selectedEvaluators, onEvaluatorsDeleted, onClearSelection } = props;
  const [isDeleteConfirmationDialogOpen, setIsDeleteConfirmationDialogOpen] =
    useState(false);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const [deleteEvaluators, isDeletingEvaluators] = useMutation(graphql`
    mutation EvaluatorSelectionToolbarDeleteEvaluatorsMutation(
      $input: DeleteEvaluatorsInput!
    ) {
      deleteEvaluators(input: $input) {
        evaluatorIds
      }
    }
  `);
  const isPlural = selectedEvaluators.length !== 1;
  const onDeleteEvaluators = useCallback(() => {
    deleteEvaluators({
      variables: {
        input: {
          evaluatorIds: selectedEvaluators.map((evaluator) => evaluator.id),
        },
      },
      onCompleted: () => {
        notifySuccess({
          title: "Evaluators Deleted",
          message: `${selectedEvaluators.length} evaluator${isPlural ? "s" : ""} have been deleted.`,
        });
        // Clear the selection
        onEvaluatorsDeleted();
        onClearSelection();
      },
      onError: (error) => {
        const formattedError = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "An error occurred",
          message: `Failed to delete evaluators: ${formattedError?.[0] ?? error.message}`,
        });
      },
    });
  }, [
    deleteEvaluators,
    selectedEvaluators,
    notifySuccess,
    isPlural,
    onEvaluatorsDeleted,
    onClearSelection,
    notifyError,
  ]);

  return (
    <FloatingToolbarContainer>
      <Toolbar>
        <View paddingEnd="size-100">
          <Flex direction="row" gap="size-100" alignItems="center">
            <TooltipTrigger>
              <IconButton
                size="M"
                onPress={onClearSelection}
                aria-label="Clear selection"
              >
                <Icon svg={<Icons.CloseOutline />} />
              </IconButton>
              <Tooltip>Clear selection</Tooltip>
            </TooltipTrigger>
            <Text>{`${selectedEvaluators.length} evaluator${isPlural ? "s" : ""} selected`}</Text>
          </Flex>
        </View>
        <Button
          variant="danger"
          size="M"
          leadingVisual={
            <Icon
              svg={
                isDeletingEvaluators ? (
                  <Icons.LoadingOutline />
                ) : (
                  <Icons.TrashOutline />
                )
              }
            />
          }
          isDisabled={isDeletingEvaluators}
          onPress={() => setIsDeleteConfirmationDialogOpen(true)}
          aria-label="Delete Evaluators"
        >
          {isDeletingEvaluators ? "Deleting..." : "Delete"}
        </Button>
      </Toolbar>
      <ModalOverlay
        isOpen={isDeleteConfirmationDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setIsDeleteConfirmationDialogOpen(false);
          }
        }}
        isDismissable
      >
        <Modal>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Evaluators</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Text>Are you sure you want to delete these evaluators?</Text>
                <ul
                  css={css`
                    padding-bottom: var(--ac-global-dimension-size-200);
                  `}
                >
                  {selectedEvaluators.map((evaluator) => (
                    <li
                      key={evaluator.id}
                      css={css`
                        padding-left: var(--ac-global-dimension-size-200);
                        padding-top: var(--ac-global-dimension-size-50);
                      `}
                    >
                      <Text>{evaluator.name}</Text>
                    </li>
                  ))}
                </ul>
                <Text>
                  This will delete the selected evaluators and remove them from
                  any datasets that use them. Annotations created by these
                  evaluators will remain in place.
                </Text>
              </View>
              <View paddingX="size-200" paddingBottom="size-100">
                <Flex direction="row" justifyContent="end" gap="size-200">
                  <Button
                    size="S"
                    onPress={() => setIsDeleteConfirmationDialogOpen(false)}
                    variant="quiet"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="S"
                    onPress={() => {
                      onDeleteEvaluators();
                      setIsDeleteConfirmationDialogOpen(false);
                    }}
                  >
                    Delete {selectedEvaluators.length} evaluator
                    {isPlural ? "s" : ""}
                  </Button>
                </Flex>
              </View>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </FloatingToolbarContainer>
  );
}
