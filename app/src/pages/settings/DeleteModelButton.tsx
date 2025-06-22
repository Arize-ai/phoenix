import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { useRevalidator } from "react-router";

import {
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
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { DeleteModelButtonMutation } from "./__generated__/DeleteModelButtonMutation.graphql";

function DeleteModelDialogContent({
  modelId,
  modelName,
  onClose,
}: {
  modelId: string;
  modelName: string;
  onClose: () => void;
}) {
  const { revalidate } = useRevalidator();
  const [commitDeleteModel, isCommittingDeleteModel] =
    useMutation<DeleteModelButtonMutation>(graphql`
      mutation DeleteModelButtonMutation($input: DeleteModelMutationInput!) {
        deleteModel(input: $input) {
          query {
            ...ModelsTable_generativeModels
          }
        }
      }
    `);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const handleDelete = useCallback(() => {
    commitDeleteModel({
      variables: {
        input: { id: modelId },
      },
      onCompleted: () => {
        notifySuccess({
          title: `Model Deleted`,
          message: `The "${modelName}" model has been deleted.`,
        });
        onClose();
        revalidate();
      },
      onError: (error) => {
        const errorMessages = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: `Failed to delete model`,
          message: errorMessages?.[0] || "Failed to delete model",
        });
      },
    });
  }, [
    commitDeleteModel,
    modelId,
    modelName,
    notifyError,
    notifySuccess,
    onClose,
    revalidate,
  ]);

  return (
    <div>
      <View padding="size-200">
        <Text color="danger">
          {`Are you sure you want to delete the "${modelName}" model? This action cannot be undone and all services dependent on this model, including associated costs, will be affected.`}
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
    </div>
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
