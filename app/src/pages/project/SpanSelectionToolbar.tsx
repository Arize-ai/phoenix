import React, { ReactNode, Suspense, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  DialogContainer,
  Flex,
  Icon,
  Icons,
  PopoverTrigger,
  Text,
  View,
} from "@arizeai/components";

import { CreateDatasetForm } from "@phoenix/components/dataset/CreateDatasetForm";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import { DatasetSelectorPopoverContent } from "./DatasetSelectorPopoverContent";

interface SelectedSpan {
  id: string;
}

type SpanSelectionToolbarProps = {
  selectedSpans: SelectedSpan[];
  onClearSelection: () => void;
};

export function SpanSelectionToolbar(props: SpanSelectionToolbarProps) {
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
            message: `${selectedSpans.length} example${isPlural ? "s" : ""} have been added to the dataset.`,
          });
          // Clear the selection
          onClearSelection();
        },
        onError: (error) => {
          notifyError({
            title: "An error occurred",
            message: `Failed to add spans to dataset: ${error.message}`,
          });
        },
      });
    },
    [
      commitSpansToDataset,
      isPlural,
      notifyError,
      notifySuccess,
      selectedSpans,
      onClearSelection,
    ]
  );
  return (
    <div
      css={css`
        position: absolute;
        bottom: var(--ac-global-dimension-size-400);
        left: 50%;
        transform: translateX(-50%);
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
            <Button variant="default" size="compact" onClick={onClearSelection}>
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
              <Button
                variant="primary"
                size="compact"
                icon={<Icon svg={<Icons.DatabaseOutline />} />}
                loading={isAddingSpansToDataset}
                disabled={isAddingSpansToDataset}
              >
                {isAddingSpansToDataset
                  ? "Adding to dataset"
                  : "Add to dataset"}
              </Button>
              <Suspense>
                <DatasetSelectorPopoverContent
                  onDatasetSelected={(datasetId) => {
                    onAddSpansToDataset(datasetId);
                    setIsDatasetPopoverOpen(false);
                  }}
                  onCreateNewDataset={() => {
                    setIsDatasetPopoverOpen(false);
                    setDialog(
                      <Dialog title="New Dataset">
                        <CreateDatasetForm
                          onDatasetCreateError={() => {
                            notifyError({
                              title: "Dataset creation failed",
                              message: "Failed to create dataset.",
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
