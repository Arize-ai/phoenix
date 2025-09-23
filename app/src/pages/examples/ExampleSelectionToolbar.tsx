import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  Flex,
  Icon,
  IconButton,
  Icons,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  Text,
  Toolbar,
  Tooltip,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { DialogCloseButton, DialogContent, DialogHeader, DialogTitle, DialogTitleExtra } from "@phoenix/components/dialog";
import { AssignSplitsDialog } from "@phoenix/components/split/AssignSplitsDialog";
import { FloatingToolbarContainer } from "@phoenix/components/toolbar/FloatingToolbarContainer";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import type { examplesLoaderQuery$data } from "./__generated__/examplesLoaderQuery.graphql";
interface SelectedExample {
  id: string;
}

type ExampleSelectionToolbarProps = {
  selectedExamples: SelectedExample[];
  splits: examplesLoaderQuery$data["datasetSplits"];
  onClearSelection: () => void;
  onExamplesDeleted: () => void;
};

export function ExampleSelectionToolbar(props: ExampleSelectionToolbarProps) {
  const refreshLatestVersion = useDatasetContext(
    (state) => state.refreshLatestVersion
  );
  const { selectedExamples, onExamplesDeleted, onClearSelection, splits } = props;
  const [isDeleteConfirmationDialogOpen, setIsDeleteConfirmationDialogOpen] =
    useState(false);
  const [isAssignSplitsOpen, setIsAssignSplitsOpen] = useState(false);
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
  const [addExamplesToSplits, isAssigningSplits] = useMutation(graphql`
    mutation ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation(
      $input: AddDatasetExamplesToDatasetSplitsInput!
    ) {
      addDatasetExamplesToDatasetSplits(input: $input) {
        query { __typename }
      }
    }
  `);
  const isPlural = selectedExamples.length !== 1;
  const availableSplits = (splits?.edges ?? [])
    .map((e) => e?.node)
    .filter(Boolean) as Array<{ id: string; name: string }>;
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
          size="M"
          onPress={() => {
            setIsAssignSplitsOpen(true);
          }}
        >
          Assign Splits
        </Button>
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
      <AssignSplitsDialog
        isOpen={isAssignSplitsOpen}
        onOpenChange={setIsAssignSplitsOpen}
        splits={availableSplits}
        defaultSelectedIds={[]}
        onConfirm={(selectedIds) => {
          if (!selectedIds.length) {
            notifyError({ title: "No splits selected", message: "Select at least one split." });
            return;
          }
          console.log(selectedExamples);
          const exampleIds = selectedExamples.map((e) => e.id);
          addExamplesToSplits({
            variables: {
              input: {
                datasetSplitIds: selectedIds,
                exampleIds,
              },
            },
            onCompleted: () => {
              notifySuccess({
                title: "Splits assigned",
                message: `Assigned ${exampleIds.length} example${exampleIds.length === 1 ? "" : "s"} to ${selectedIds.length} split${selectedIds.length === 1 ? "" : "s"}.`,
              });
            },
            onError: (error) => {
              const formattedError = getErrorMessagesFromRelayMutationError(error);
              notifyError({
                title: "Failed to assign splits",
                message: formattedError?.[0] ?? error.message,
              });
            },
          });
        }}
      />
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
