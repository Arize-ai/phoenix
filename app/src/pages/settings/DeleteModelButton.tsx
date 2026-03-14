import { useCallback, useState } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { DeleteModelButtonMutation } from "./__generated__/DeleteModelButtonMutation.graphql";

function DeleteModelDialogContent({
  modelId,
  modelName,
  onClose,
}: {
  modelId: string;
  modelName: string;
  onClose: () => void;
}) {
  const connectionId = ConnectionHandler.getConnectionID(
    "client:root",
    "ModelsTable_generativeModels"
  );
  const [commitDeleteModel, isCommittingDeleteModel] =
    useMutation<DeleteModelButtonMutation>(graphql`
      mutation DeleteModelButtonMutation(
        $input: DeleteModelMutationInput!
        $connectionId: ID!
      ) {
        deleteModel(input: $input) {
          query {
            ...ModelsTable_generativeModels
          }
          model {
            id @deleteEdge(connections: [$connectionId])
          }
        }
      }
    `);
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(() => {
    commitDeleteModel({
      variables: {
        input: { id: modelId },
        connectionId,
      },
      onCompleted: () => {
        notifySuccess({
          title: `Model Deleted`,
          message: `The "${modelName}" model has been deleted.`,
        });
        onClose();
      },
      onError: (error) => {
        const errorMessages = getErrorMessagesFromRelayMutationError(error);
        setError(errorMessages?.[0] || "Failed to delete model");
      },
    });
  }, [
    commitDeleteModel,
    modelId,
    modelName,
    notifySuccess,
    onClose,
    connectionId,
  ]);

  return (
    <>
      {error && <Alert variant="danger">{error}</Alert>}
      <View padding="size-200">
        <Text color="danger">
          {`Are you sure you want to delete the "${modelName}" model? This action cannot be undone and all services dependent on this model, including associated costs, will be affected.`}
        </Text>
      </View>
      <View
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        borderTopColor="default"
        borderTopWidth="thin"
      >
        <Flex direction="row" justifyContent="end" gap="size-100">
          <Button variant="default" onPress={onClose} size="S">
            Cancel
          </Button>
          <Button
            variant="danger"
            onPress={() => {
              handleDelete();
            }}
            size="S"
            isDisabled={isCommittingDeleteModel}
          >
            Delete Model
          </Button>
        </Flex>
      </View>
    </>
  );
}

export function DeleteModelButton({
  modelId,
  modelName,
}: {
  modelId: string;
  modelName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Button
        variant="danger"
        leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
        aria-label="Delete model"
        onPress={handleOpen}
        size="S"
      />
      <ModalOverlay>
        <Modal>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Model</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <DeleteModelDialogContent
                modelId={modelId}
                modelName={modelName}
                onClose={handleClose}
              />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
