import { useCallback, useMemo, useState } from "react";
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
import { ManageDatasetSplitsDialog } from "@phoenix/components/datasetSplit/ManageDatasetSplitsDialog";
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
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
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
  const isSplitsEnabled = useFeatureFlag("datasetSplitsUI");
  const { selectedExamples, onExamplesDeleted, onClearSelection } = props;
  const [isDeleteConfirmationDialogOpen, setIsDeleteConfirmationDialogOpen] =
    useState(false);
  const [isManageSplitsOpen, setIsManageSplitsOpen] = useState(false);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  // Get split ids that are shared by all selected examples
  // This is used to calculate which splits to add/remove
  const sharedSplitIds = useMemo<Set<string>>(() => {
    if (selectedExamples.length === 0) return new Set<string>();
    const splitIdArrays = selectedExamples.map(
      (ex) => ex.splits.map((s) => s.id) ?? []
    );
    const intersection = splitIdArrays.reduce((acc, curr) =>
      acc.filter((id) => curr.includes(id))
    );

    return new Set(intersection);
  }, [selectedExamples]);

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
  // TODO: Update mutation to fetch updated examples
  const [addExamplesToSplits, isAddingExamplesToSplits] = useMutation(graphql`
    mutation ExampleSelectionToolbarAddDatasetExamplesToDatasetSplitsMutation(
      $input: AddDatasetExamplesToDatasetSplitsInput!
    ) {
      addDatasetExamplesToDatasetSplits(input: $input) {
        examples {
          id
          datasetSplits {
            id
            name
            color
          }
        }
      }
    }
  `);

  const [removeExamplesFromSplit, isRemovingExamplesFromSplit] = useMutation(
    graphql`
      mutation ExampleSelectionToolbarRemoveDatasetExamplesFromDatasetSplitMutation(
        $input: RemoveDatasetExamplesFromDatasetSplitsInput!
      ) {
        removeDatasetExamplesFromDatasetSplits(input: $input) {
          examples {
            id
            datasetSplits {
              id
              name
              color
            }
          }
        }
      }
    `
  );

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

  const handleManageSplitsConfirm = useCallback(
    (selectedIds: string[]) => {
      const desiredIds = new Set(selectedIds);
      const sharedIds = new Set(Array.from(sharedSplitIds));
      const splitsToAdd = Array.from(desiredIds).filter(
        (id) => !sharedIds.has(id)
      ); // D - A
      const splitsToRemove = Array.from(sharedIds).filter(
        (id) => !desiredIds.has(id)
      ); // A - D

      const exampleIds = selectedExamples.map((e) => e.id);
      splitsToAdd.length > 0 &&
        !isAddingExamplesToSplits &&
        addExamplesToSplits({
          variables: {
            input: {
              datasetSplitIds: splitsToAdd,
              exampleIds,
            },
          },
          onCompleted: () => {
            // refreshLatestVersion();
          },
          onError: (error) => {
            const formattedError =
              getErrorMessagesFromRelayMutationError(error);
            notifyError({
              title: "Failed to assign splits",
              message: formattedError?.[0] ?? error.message,
            });
          },
        });

      splitsToRemove.length > 0 &&
        !isRemovingExamplesFromSplit &&
        removeExamplesFromSplit({
          variables: {
            input: {
              datasetSplitIds: splitsToRemove,
              exampleIds,
            },
          },
          onCompleted: () => {
            // refreshLatestVersion();
          },
          onError: (error) => {
            const formattedError =
              getErrorMessagesFromRelayMutationError(error);
            notifyError({
              title: "Failed to remove splits",
              message: formattedError?.[0] ?? error.message,
            });
          },
        });
    },
    [
      addExamplesToSplits,
      isAddingExamplesToSplits,
      isRemovingExamplesFromSplit,
      notifyError,
      removeExamplesFromSplit,
      selectedExamples,
      sharedSplitIds,
    ]
  );
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
        {isSplitsEnabled && (
          <Button
            size="M"
            onPress={() => {
              setIsManageSplitsOpen(true);
            }}
          >
            Manage Splits
          </Button>
        )}
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
      {isManageSplitsOpen && (
        <ManageDatasetSplitsDialog
          selectedExamples={selectedExamples}
          isOpen={isManageSplitsOpen}
          onOpenChange={setIsManageSplitsOpen}
          onConfirm={handleManageSplitsConfirm}
        />
      )}
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
