import React, { startTransition, useCallback } from "react";
import { useMutation } from "react-relay";
import { graphql } from "relay-runtime";

import { Button, Dialog, Flex, Text, View } from "@arizeai/components";

import { DatasetActionMenuDeleteMutation } from "./__generated__/DatasetActionMenuDeleteMutation.graphql";

export function DeleteDatasetDialog({
  datasetId,
  datasetName,
  onDatasetDelete,
  onDatasetDeleteError,
}: {
  datasetId: string;
  datasetName: string;
  onDatasetDelete: () => void;
  onDatasetDeleteError: (error: Error) => void;
}) {
  const [commitDelete, isCommittingDelete] =
    useMutation<DatasetActionMenuDeleteMutation>(graphql`
      mutation DeleteDatasetDialogMutation($datasetId: GlobalID!) {
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
      });
    });
  }, [commitDelete, datasetId, onDatasetDelete, onDatasetDeleteError]);
  return (
    <Dialog size="S" title="Delete Dataset">
      <View padding="size-200">
        <Text color="danger">
          {`Are you sure you want to delete dataset ${datasetName}? This will also delete all associated experiments and traces, and it cannot be undone.`}
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
            }}
            disabled={isCommittingDelete}
            loading={isCommittingDelete}
          >
            Delete Dataset
          </Button>
        </Flex>
      </View>
    </Dialog>
  );
}
