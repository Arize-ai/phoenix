import { ReactNode, Suspense, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";
import { css } from "@emotion/react";

// eslint-disable-next-line deprecate/import
import {
  Dialog,
  DialogContainer,
  PopoverTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { Button, Flex, Icon, Icons, Text, View } from "@phoenix/components";
import { CreateDatasetForm } from "@phoenix/components/dataset/CreateDatasetForm";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { DatasetSelectorPopoverContent } from "./DatasetSelectorPopoverContent";

interface SelectedSpan {
  id: string;
  traceId: string;
}

type SpanSelectionToolbarProps = {
  selectedSpans: SelectedSpan[];
  onClearSelection: () => void;
};

export function SpanSelectionToolbar(props: SpanSelectionToolbarProps) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<ReactNode>(null);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [isDatasetPopoverOpen, setIsDatasetPopoverOpen] = useState(false);
  const { selectedSpans, onClearSelection } = props;
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
    const traceIds = [...new Set(selectedSpans.map((span) => span.traceId))];
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
    selectedSpans,
    notifySuccess,
    onClearSelection,
    notifyError,
  ]);

  const onDeletePress = useCallback(() => {
    setDialog(
      <Dialog
        size="S"
        title="Delete Traces"
        isDismissable
        onDismiss={() => setDialog(null)}
      >
        <View padding="size-200">
          <Text color="danger">
            Are you sure you want to delete the selected spans and their traces?
          </Text>
        </View>
        <View
          paddingEnd="size-200"
          paddingTop="size-100"
          paddingBottom="size-100"
          borderTopColor="light"
          borderTopWidth="thin"
        >
          <Flex direction="row" justifyContent="end">
            <Button
              variant="danger"
              onPress={() => {
                onDeleteTraces();
                setDialog(null);
              }}
            >
              Delete Traces
            </Button>
          </Flex>
        </View>
      </Dialog>
    );
  }, [onDeleteTraces]);

  return (
    <div
      css={css`
        position: absolute;
        bottom: var(--ac-global-dimension-size-600);
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        box-shadow: 8px 8px 20px 0 rgba(0, 0, 0, 0.4);
        border-radius: var(--ac-global-rounding-medium);
      `}
    >
      <View
        backgroundColor="light"
        padding="size-200"
        borderColor="light"
        borderWidth="thin"
        borderRadius="medium"
        minWidth="size-6000"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Text>{`${selectedSpans.length} span${isPlural ? "s" : ""} selected`}</Text>
          <Flex direction="row" gap="size-100">
            <Button variant="default" size="S" onPress={onClearSelection}>
              Cancel
            </Button>
            <PopoverTrigger
              placement="top end"
              crossOffset={300}
              isOpen={isDatasetPopoverOpen}
              onOpenChange={(isOpen) => {
                setIsDatasetPopoverOpen(isOpen);
              }}
            >
              <TriggerWrap>
                <Button
                  variant="default"
                  size="S"
                  leadingVisual={
                    isAddingSpansToDataset ? (
                      <Icons.LoadingOutline />
                    ) : (
                      <Icons.DatabaseOutline />
                    )
                  }
                  onPress={() => {
                    setIsDatasetPopoverOpen(true);
                  }}
                  isDisabled={isAddingSpansToDataset}
                >
                  {isAddingSpansToDataset ? "Adding..." : "Add to Dataset"}
                </Button>
              </TriggerWrap>
              <Suspense>
                <DatasetSelectorPopoverContent
                  onDatasetSelected={(datasetId) => {
                    onAddSpansToDataset(datasetId);
                    setIsDatasetPopoverOpen(false);
                  }}
                  onCreateNewDataset={() => {
                    setIsDatasetPopoverOpen(false);
                    setDialog(
                      <Dialog
                        title="New Dataset"
                        isDismissable
                        onDismiss={() => setDialog(null)}
                      >
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
                            setDialog(null);
                            notifySuccess({
                              title: "Dataset created",
                              message: `${dataset.name} has been successfully created.`,
                            });
                            setIsDatasetPopoverOpen(true);
                          }}
                        />
                      </Dialog>
                    );
                  }}
                />
              </Suspense>
            </PopoverTrigger>
            <Button
              variant="danger"
              size="S"
              leadingVisual={
                <Icon
                  svg={
                    isDeletingTraces ? (
                      <Icons.LoadingOutline />
                    ) : (
                      <Icons.TrashOutline />
                    )
                  }
                />
              }
              isDisabled={isDeletingTraces}
              onPress={onDeletePress}
            >
              {isDeletingTraces ? "Deleting..." : "Delete"}
            </Button>
          </Flex>
        </Flex>
      </View>
      <DialogContainer
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </div>
  );
}
