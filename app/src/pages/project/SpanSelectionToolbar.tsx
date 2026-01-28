import { Suspense, useCallback, useMemo, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Group,
  Icon,
  IconButton,
  Icons,
  Modal,
  ModalOverlay,
  Popover,
  PopoverArrow,
  Text,
  Toolbar,
  View,
} from "@phoenix/components";
import { CreateDatasetForm } from "@phoenix/components/dataset/CreateDatasetForm";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { FloatingToolbarContainer } from "@phoenix/components/toolbar/FloatingToolbarContainer";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { DatasetSelectorPopoverContent } from "./DatasetSelectorPopoverContent";
import { TransferTracesButton } from "./TransferTracesButton";

interface SelectedSpan {
  id: string;
  traceId: string;
}

type SpanSelectionToolbarProps = {
  selectedSpans: SelectedSpan[];
  onClearSelection: () => void;
};

export function SpanSelectionToolbar(props: SpanSelectionToolbarProps) {
  const projectId = useTracingContext((state) => state.projectId);
  const { setFetchKey } = useStreamState();
  const navigate = useNavigate();
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [isCreatingDataset, setIsCreatingDataset] = useState(false);
  const [isDatasetPopoverOpen, setIsDatasetPopoverOpen] = useState(false);
  const [isDeletingTracesDialogOpen, setIsDeletingTracesDialogOpen] =
    useState(false);
  const { selectedSpans, onClearSelection } = props;

  const traceIds = useMemo(
    () => [...new Set(selectedSpans.map((span) => span.traceId))],
    [selectedSpans]
  );
  const [commitSpansToDataset, isAddingSpansToDataset] = useMutation(graphql`
    mutation SpanSelectionToolbarAddSpansToDatasetMutation(
      $input: AddSpansToDatasetInput!
    ) {
      addSpansToDataset(input: $input) {
        dataset {
          id
        }
      }
    }
  `);
  const [commitDeleteTraces, isDeletingTraces] = useMutation(graphql`
    mutation SpanSelectionToolbarDeleteTracesMutation($traceIds: [ID!]!) {
      deleteTraces(traceIds: $traceIds) {
        __typename
      }
    }
  `);
  const isPlural = selectedSpans.length !== 1;
  const onAddSpansToDataset = useCallback(
    (datasetId: string) => {
      commitSpansToDataset({
        variables: {
          input: {
            datasetId,
            spanIds: selectedSpans.map((span) => span.id),
          },
        },
        onCompleted: () => {
          notifySuccess({
            title: "Examples added to dataset",
            message: `${selectedSpans.length} example${isPlural ? "s have" : " has"} been added to the dataset.`,
            action: {
              text: "View dataset",
              onClick: () => {
                // Navigate to the dataset page
                navigate(`/datasets/${datasetId}/examples`);
              },
            },
          });
          // Clear the selection
          onClearSelection();
        },
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          notifyError({
            title: "An error occurred",
            message: `Failed to add spans to dataset: ${formattedError?.[0] ?? error.message}`,
          });
        },
      });
    },
    [
      commitSpansToDataset,
      selectedSpans,
      notifySuccess,
      isPlural,
      onClearSelection,
      navigate,
      notifyError,
    ]
  );
  const onDeleteTraces = useCallback(() => {
    commitDeleteTraces({
      variables: {
        traceIds,
      },
      onCompleted: () => {
        notifySuccess({
          title: "Traces deleted",
          message: `${traceIds.length} trace${traceIds.length !== 1 ? "s have" : " has"} been deleted.`,
        });
        onClearSelection();
      },
      onError: (error) => {
        const formattedError = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "An error occurred",
          message: `Failed to delete traces: ${formattedError?.[0] ?? error.message}`,
        });
      },
    });
  }, [
    commitDeleteTraces,
    traceIds,
    notifySuccess,
    onClearSelection,
    notifyError,
  ]);

  const onDeletePress = () => {
    setIsDeletingTracesDialogOpen(true);
  };

  return (
    <FloatingToolbarContainer>
      <Toolbar>
        <Group aria-label="Span selection">
          <IconButton
            size="M"
            onPress={onClearSelection}
            aria-label="Clear selection"
          >
            <Icon svg={<Icons.CloseOutline />} />
          </IconButton>
          <View paddingEnd="size-100">
            <Text>{`${selectedSpans.length} span${isPlural ? "s" : ""} selected`}</Text>
          </View>
        </Group>
        <Group aria-label="Span selection actions">
          <DialogTrigger
            isOpen={isDatasetPopoverOpen}
            onOpenChange={(isOpen) => {
              setIsDatasetPopoverOpen(isOpen);
            }}
          >
            <Button
              variant="primary"
              size="M"
              leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
              onPress={() => {
                setIsDatasetPopoverOpen(true);
              }}
              isDisabled={isAddingSpansToDataset}
            >
              {isAddingSpansToDataset ? "Adding..." : "Add to Dataset"}
            </Button>
            <Popover placement="top end">
              <Suspense>
                <PopoverArrow />
                <Dialog>
                  <DatasetSelectorPopoverContent
                    onDatasetSelected={(datasetId) => {
                      onAddSpansToDataset(datasetId);
                      setIsDatasetPopoverOpen(false);
                    }}
                    onCreateNewDataset={() => {
                      setIsDatasetPopoverOpen(false);
                      setIsCreatingDataset(true);
                    }}
                  />
                </Dialog>
              </Suspense>
            </Popover>
          </DialogTrigger>
          <TransferTracesButton
            traceIds={traceIds}
            currentProjectId={projectId}
            onSuccess={({ projectName }) => {
              notifySuccess({
                title: "Transfer Success",
                message: `The traces have been moved to project: ${projectName}`,
              });
              onClearSelection();
              setFetchKey(`trace-transfer-${Date.now()}`);
            }}
            onError={(error) => {
              notifyError({
                title: "Transfer Failed",
                message: `Failed to transfer due to error: ${error.message}`,
              });
            }}
          />
          {/* Add dataset dialog */}
          <DialogTrigger
            isOpen={isCreatingDataset}
            onOpenChange={setIsCreatingDataset}
          >
            <ModalOverlay>
              <Modal>
                <Dialog>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>New Dataset</DialogTitle>
                      <DialogTitleExtra>
                        <Button
                          variant="default"
                          size="S"
                          onPress={() => {
                            setIsCreatingDataset(false);
                          }}
                          leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
                        ></Button>
                      </DialogTitleExtra>
                    </DialogHeader>
                    <CreateDatasetForm
                      onDatasetCreateError={(error) => {
                        const formattedError =
                          getErrorMessagesFromRelayMutationError(error);
                        notifyError({
                          title: "Dataset creation failed",
                          message: `Failed to create dataset: ${formattedError?.[0] ?? error.message}`,
                        });
                      }}
                      onDatasetCreated={(dataset) => {
                        setIsCreatingDataset(false);
                        notifySuccess({
                          title: "Dataset created",
                          message: `${dataset.name} has been successfully created.`,
                        });
                        setIsDatasetPopoverOpen(true);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
          <Button
            size="M"
            aria-label="Delete Traces"
            isDisabled={isDeletingTraces}
            onPress={onDeletePress}
            variant="danger"
            leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
          ></Button>
          {/* Delete traces dialog */}
          <DialogTrigger
            isOpen={isDeletingTracesDialogOpen}
            onOpenChange={setIsDeletingTracesDialogOpen}
          >
            <ModalOverlay>
              <Modal>
                <Dialog>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Traces</DialogTitle>
                    </DialogHeader>
                    <View padding="size-200">
                      <Text color="danger">
                        Are you sure you want to delete the selected spans and
                        their traces?
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
                          variant="default"
                          onPress={() => {
                            setIsDeletingTracesDialogOpen(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="danger"
                          onPress={() => {
                            onDeleteTraces();
                            setIsDeletingTracesDialogOpen(false);
                          }}
                        >
                          Delete Traces
                        </Button>
                      </Flex>
                    </View>
                  </DialogContent>
                </Dialog>
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
        </Group>
      </Toolbar>
    </FloatingToolbarContainer>
  );
}
