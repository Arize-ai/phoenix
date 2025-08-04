import { startTransition, useCallback } from "react";
import { useMutation } from "react-relay";
import { graphql } from "relay-runtime";

import {
  Button,
  Dialog,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";

import { DeleteDatasetDialogMutation } from "./__generated__/DeleteDatasetDialogMutation.graphql";

export type DeleteDatasetDialogProps = {
  datasetId: string;
  datasetName: string;
  onDatasetDelete: () => void;
  onDatasetDeleteError: (error: Error) => void;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

export function DeleteDatasetDialog({
  datasetId,
  datasetName,
  onDatasetDelete,
  onDatasetDeleteError,
  isOpen,
  onOpenChange,
}: DeleteDatasetDialogProps) {
  const [commitDelete, isCommittingDelete] =
    useMutation<DeleteDatasetDialogMutation>(graphql`
      mutation DeleteDatasetDialogMutation($datasetId: ID!) {
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
          if (onOpenChange) {
            onOpenChange(false);
          }
        },
        onError: (error) => {
          onDatasetDeleteError(error);
        },
      });
    });
  }, [
    commitDelete,
    datasetId,
    onDatasetDelete,
    onDatasetDeleteError,
    onOpenChange,
  ]);

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal size="S">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Dataset</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton />
              </DialogTitleExtra>
            </DialogHeader>
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
              <Flex direction="row" justifyContent="end" gap="size-100">
                <Button size="S" onPress={() => onOpenChange?.(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="S"
                  onPress={() => {
                    handleDelete();
                  }}
                  isDisabled={isCommittingDelete}
                  leadingVisual={
                    <Icon
                      svg={
                        isCommittingDelete ? (
                          <Icons.LoadingOutline />
                        ) : (
                          <Icons.TrashOutline />
                        )
                      }
                    />
                  }
                >
                  Delete Dataset
                </Button>
              </Flex>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
