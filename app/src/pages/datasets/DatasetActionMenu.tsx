import React, {
  ReactNode,
  startTransition,
  useCallback,
  useState,
} from "react";
import { graphql, useMutation } from "react-relay";

import {
  ActionMenu,
  Button,
  Dialog,
  DialogContainer,
  Flex,
  Icon,
  Icons,
  Item,
  Text,
  View,
} from "@arizeai/components";

import { DatasetActionMenuDeleteMutation } from "./__generated__/DatasetActionMenuDeleteMutation.graphql";

type DatasetActionMenuProps = {
  datasetId: string;
  datasetName: string;
  onDatasetDelete: () => void;
  onDatasetDeleteError: (error: Error) => void;
};

enum DatasetAction {
  DELETE = "deleteDataset",
}

export function DatasetActionMenu(props: DatasetActionMenuProps) {
  const { datasetId, datasetName, onDatasetDelete, onDatasetDeleteError } =
    props;
  const [confirmDialog, setConfirmDialog] = useState<ReactNode>(null);
  const [commitDelete, isCommittingDelete] =
    useMutation<DatasetActionMenuDeleteMutation>(graphql`
      mutation DatasetActionMenuDeleteMutation($datasetId: GlobalID!) {
        deleteDataset(input: { datasetId: $datasetId }) {
          __typename
        }
      }
    `);
  const handleDelete = useCallback(() => {
    startTransition(() => {
      commitDelete({
        variables: {
          datasetId,
        },
        onCompleted: () => {
          onDatasetDelete();
        },
        onError: (error) => {
          onDatasetDeleteError(error);
        },
        updater: (store) => {
          // Invalidate the dataset in the store
          const datasetNode = store.get(datasetId);
          if (datasetNode) {
            datasetNode.invalidateRecord();
          }
        },
      });
    });
  }, [commitDelete, datasetId, onDatasetDelete, onDatasetDeleteError]);
  const onDelete = useCallback(() => {
    setConfirmDialog(
      <Dialog size="S" title="Delete Dataset">
        <View padding="size-200">
          <Text color="danger">
            {`Are you sure you want to delete dataset ${datasetName}? This cannot be undone.`}
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
              onClick={() => {
                handleDelete();
                setConfirmDialog(null);
              }}
            >
              Delete Dataset
            </Button>
          </Flex>
        </View>
      </Dialog>
    );
  }, [handleDelete, datasetName]);
  return (
    <div
      // TODO: add this logic to the ActionMenu component
      onClick={(e) => {
        // prevent parent anchor link from being followed
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <ActionMenu
        align="end"
        buttonSize="compact"
        isDisabled={isCommittingDelete}
        onAction={(action) => {
          switch (action) {
            case DatasetAction.DELETE:
              onDelete();
              break;
          }
        }}
      >
        <Item key={DatasetAction.DELETE}>
          <Flex
            direction={"row"}
            gap="size-75"
            justifyContent={"start"}
            alignItems={"center"}
          >
            <Icon svg={<Icons.TrashOutline />} />
            <Text>Delete</Text>
          </Flex>
        </Item>
      </ActionMenu>
      <DialogContainer
        type="modal"
        isDismissable
        onDismiss={() => setConfirmDialog(null)}
      >
        {confirmDialog}
      </DialogContainer>
    </div>
  );
}
