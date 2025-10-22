import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

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
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

interface SelectedExample {
  id: string;
  splits: readonly {
    readonly id: string;
    readonly color: string;
    readonly name: string;
  }[];
}

type ExampleSelectionToolbarProps = {
  selectedExamples: SelectedExample[];
  onClearSelection: () => void;
  onExamplesDeleted: () => void;
};

export function ExampleSelectionToolbar(props: ExampleSelectionToolbarProps) {
  const refreshLatestVersion = useDatasetContext(
    (state) => state.refreshLatestVersion
  );
  const { selectedExamples, onExamplesDeleted, onClearSelection } = props;
  const [isDeleteConfirmationDialogOpen, setIsDeleteConfirmationDialogOpen] =
    useState(false);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const [deleteExamples, isDeletingExamples] = useMutation(graphql`
    mutation ExampleSelectionToolbarDeleteExamplesMutation(
      $input: DeleteDatasetExamplesInput!
    ) {
      deleteDatasetExamples(input: $input) {
        dataset {
          id
        }
      }
    }
  `);
  const isPlural = selectedExamples.length !== 1;
  const onDeleteExamples = useCallback(() => {
    deleteExamples({
      variables: {
        input: {
          exampleIds: selectedExamples.map((example) => example.id),
        },
      },
      onCompleted: () => {
        notifySuccess({
          title: "Examples Deleted",
          message: `${selectedExamples.length} example${isPlural ? "s" : ""} have been deleted.`,
        });
        // Clear the selection
        onExamplesDeleted();
        onClearSelection();
        // Notify the dataset store to refresh the latest version
        refreshLatestVersion();
      },
      onError: (error) => {
        const formattedError = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "An error occurred",
          message: `Failed to delete examples: ${formattedError?.[0] ?? error.message}`,
        });
      },
    });
  }, [
    deleteExamples,
    selectedExamples,
    notifySuccess,
    isPlural,
    onExamplesDeleted,
    onClearSelection,
    refreshLatestVersion,
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
            <Text>{`${selectedExamples.length} example${isPlural ? "s" : ""} selected`}</Text>
          </Flex>
        </View>
        <Button
          variant="danger"
          size="M"
          leadingVisual={
            <Icon
              svg={
                isDeletingExamples ? (
                  <Icons.LoadingOutline />
                ) : (
                  <Icons.TrashOutline />
                )
              }
            />
          }
          isDisabled={isDeletingExamples}
          onPress={() => setIsDeleteConfirmationDialogOpen(true)}
          aria-label="Delete Examples"
        >
          {isDeletingExamples ? "Deleting..." : "Delete"}
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
                <DialogTitle>Delete Examples</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Text color="danger">
                  Are you sure you want to delete {selectedExamples.length}{" "}
                  example{isPlural ? "s" : ""}?
                </Text>
              </View>
              <View
                paddingEnd="size-200"
                paddingTop="size-100"
                paddingBottom="size-100"
                borderTopColor="light"
                borderTopWidth="thin"
              >
                <Flex direction="row" justifyContent="end" gap="size-100">
                  <Button
                    size="S"
                    onPress={() => setIsDeleteConfirmationDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="S"
                    onPress={() => {
                      onDeleteExamples();
                      setIsDeleteConfirmationDialogOpen(false);
                    }}
                  >
                    Delete
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
