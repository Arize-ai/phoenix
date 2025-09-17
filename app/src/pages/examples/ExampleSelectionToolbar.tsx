import { useCallback, useMemo, useState } from "react";
import { graphql, useMutation } from "react-relay";
import type { ExampleSelectionToolbarCreateDatasetSplitMutation } from "./__generated__/ExampleSelectionToolbarCreateDatasetSplitMutation.graphql";
import type { ExampleSelectionToolbarAddExamplesToDatasetSplitMutation } from "./__generated__/ExampleSelectionToolbarAddExamplesToDatasetSplitMutation.graphql";

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
  Popover,
  Input,
  Text,
  Toolbar,
  Tooltip,
  TooltipTrigger,
  View,
  DialogTrigger,
  SelectChevronUpDownIcon,
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
import { TextField } from "@phoenix/components/field/TextField";

interface SelectedExample {
  id: string;
}

type ExampleSelectionToolbarProps = {
  selectedExamples: SelectedExample[];
  onClearSelection: () => void;
  onExamplesDeleted: () => void;
  splits: Array<{ id: string; name: string }>;
};

export function ExampleSelectionToolbar(props: ExampleSelectionToolbarProps) {
  const refreshLatestVersion = useDatasetContext(
    (state) => state.refreshLatestVersion
  );
  const { selectedExamples, onExamplesDeleted, onClearSelection } = props;
  const [isDeleteConfirmationDialogOpen, setIsDeleteConfirmationDialogOpen] =
    useState(false);
  const [isAddingToDatasetSplitDialogOpen, setIsAddingToDatasetSplitDialogOpen] =
    useState(false);
  const [isCreateSplitOpen, setIsCreateSplitOpen] = useState(false);
  const [newSplitName, setNewSplitName] = useState("");
  const [selectedSplitIds, setSelectedSplitIds] = useState<Set<string>>(new Set());
  const [localAddedSplits, setLocalAddedSplits] = useState<Array<{ id: string; name: string }>>(
    []
  );
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

  const fullySelectedSplitIds = useMemo<Set<string>>(() => {
    if (selectedExamples.length === 0) return new Set<string>();
    const [first, ...rest] = selectedExamples as Array<{
      id: string;
      splitIds?: string[];
    }>;
    let acc = new Set<string>(first.splitIds ?? []);
    for (const ex of rest) {
      const ids = new Set<string>(ex.splitIds ?? []);
      acc = new Set(Array.from(acc).filter((id) => ids.has(id)));
      if (acc.size === 0) break;
    }
    return acc;
  }, [selectedExamples]);
  console.log("fullySelectedSplitIds", fullySelectedSplitIds);
  console.log("selectedExamples", selectedExamples);
  const availableSplits = useMemo(() => {
    const serverSplits = props.splits ?? [];
    return [
      ...serverSplits,
      ...localAddedSplits.filter(
        (ls) => !serverSplits.some((s) => s && s.id === ls.id)
      ),
    ];
  }, [props.splits, localAddedSplits]);

  const [createSplit, isCreatingSplit] = useMutation<ExampleSelectionToolbarCreateDatasetSplitMutation>(graphql`
    mutation ExampleSelectionToolbarCreateDatasetSplitMutation(
      $input: CreateDatasetSplitInput!
    ) {
      createDatasetSplit(input: $input) {
        datasetSplit {
          id
          name
        }
      }
    }
  `);

  const [addExamplesToSplit, isAddingExamplesToSplit] = useMutation<ExampleSelectionToolbarAddExamplesToDatasetSplitMutation>(graphql`
    mutation ExampleSelectionToolbarAddExamplesToDatasetSplitMutation(
      $input: AddDatasetExamplesToDatasetSplitInput!
    ) {
      addDatasetExamplesToDatasetSplit(input: $input) {
        datasetSplit {
          id
          name
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
  const onCreateSplit = useCallback(() => {
    const trimmed = newSplitName.trim();
    if (!trimmed) return;
    createSplit({
      variables: {
        input: {
          name: trimmed,
          description: null,
        },
      },
      onCompleted: (res) => {
        const created = res?.createDatasetSplit?.datasetSplit;
        if (created) {
          setLocalAddedSplits((prev) => [
            ...prev,
            { id: created.id, name: created.name },
          ]);
          setSelectedSplitIds((prev) => new Set([...Array.from(prev), created.id]));
          notifySuccess({
            title: "Split created",
            message: `Created split \"${created.name}\"`,
          });
          setNewSplitName("");
          setIsCreateSplitOpen(false);
        }
      },
      onError: (error) => {
        const formattedError = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Failed to create split",
          message: formattedError?.[0] ?? error.message,
        });
      },
    });
  }, [createSplit, newSplitName, notifyError, notifySuccess]);

  const onConfirmAddToSplits = useCallback(() => {
    const splitIds = Array.from(selectedSplitIds);
    if (splitIds.length === 0) {
      notifyError({ title: "No splits selected", message: "Select at least one split." });
      return;
    }
    const exampleIds = selectedExamples.map((e) => e.id);
    let completed = 0;
    let hadError = false;
    splitIds.forEach((splitId) => {
      addExamplesToSplit({
        variables: {
          input: {
            datasetSplitId: splitId,
            exampleIds,
          },
        },
        onCompleted: () => {
          completed += 1;
          if (completed === splitIds.length && !hadError) {
            notifySuccess({
              title: "Added to split",
              message: `Added ${exampleIds.length} example${isPlural ? "s" : ""} to ${splitIds.length} split${splitIds.length > 1 ? "s" : ""}.`,
            });
            setIsAddingToDatasetSplitDialogOpen(false);
            setSelectedSplitIds(new Set());
          }
        },
        onError: (error) => {
          hadError = true;
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          notifyError({
            title: "Failed to add to split",
            message: formattedError?.[0] ?? error.message,
          });
        },
      });
    });
  }, [addExamplesToSplit, isPlural, notifyError, notifySuccess, selectedExamples, selectedSplitIds]);
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
        <Button variant="primary" size="M" onPress={() => {
            setIsAddingToDatasetSplitDialogOpen(true);          
        }}>
          Add to Dataset Split
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
      <ModalOverlay
        isOpen={isAddingToDatasetSplitDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setIsAddingToDatasetSplitDialogOpen(false);
            setIsCreateSplitOpen(false);
            setNewSplitName("");
            setSelectedSplitIds(new Set());
          } else {
            // Initialize selection to the fully-selected splits for current examples
            setSelectedSplitIds(new Set(fullySelectedSplitIds));
          }
        }}
        isDismissable
      >
        <Modal>
          <Dialog aria-label="Add to Dataset Split">
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add to Dataset Split</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Flex direction="column" gap="size-200">
                  <Flex direction="row" gap="size-200" alignItems="end">
                    <View flex>
                      <Label>Add to split</Label>
                      {isCreateSplitOpen ? (
                        <Flex direction="row" gap="size-100" alignItems="end">
                          <TextField
                            aria-label="New split name"
                            value={newSplitName}
                            onChange={setNewSplitName}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") onCreateSplit();
                            }}
                          >
                            <Input placeholder="New split name" />
                          </TextField>
                          <Button
                            variant="primary"
                            size="S"
                            isDisabled={isCreatingSplit}
                            onPress={onCreateSplit}
                          >
                            {isCreatingSplit ? "Creating..." : "Create"}
                          </Button>
                          <Button size="S" onPress={() => setIsCreateSplitOpen(false)}>
                            Cancel
                          </Button>
                        </Flex>
                      ) : (
                        <Button
                          size="S"
                          leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
                          onPress={() => setIsCreateSplitOpen(true)}
                        >
                          New split
                        </Button>
                      )}
                    </View>
                  </Flex>

                  <View>
                    <Label>Select splits</Label>
                    <DialogTrigger>
                      <Button trailingVisual={<SelectChevronUpDownIcon />}>
                        {selectedSplitIds.size > 0
                          ? `${selectedSplitIds.size} split${selectedSplitIds.size > 1 ? "s" : ""} selected`
                          : "Choose splits"}
                      </Button>
                      <Popover placement="bottom start">
                        <Dialog aria-label="Choose dataset splits">
                          <ListBox
                            selectionMode="multiple"
                            aria-label="Dataset splits"
                            selectedKeys={Array.from(selectedSplitIds)}
                            onSelectionChange={(keys) => {
                              if (keys === "all") {
                                setSelectedSplitIds(
                                  new Set(availableSplits.map((s) => s.id))
                                );
                              } else {
                                setSelectedSplitIds(
                                  new Set(Array.from(keys as Iterable<unknown>).map(String))
                                );
                              }
                            }}
                          >
                            {availableSplits.map((split) => (
                              <ListBoxItem key={split.id} id={split.id}>
                                {split.name}
                              </ListBoxItem>
                            ))}
                          </ListBox>
                        </Dialog>
                      </Popover>
                    </DialogTrigger>
                  </View>
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
                  <Button size="S" onPress={() => setIsAddingToDatasetSplitDialogOpen(false)}>
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    size="S"
                    isDisabled={isAddingExamplesToSplit}
                    onPress={onConfirmAddToSplits}
                  >
                    {isAddingExamplesToSplit ? "Adding..." : "Add"}
                  </Button>
                </Flex>
              </View>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
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
