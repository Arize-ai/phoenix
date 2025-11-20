import { useCallback, useState } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

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

import type { DeleteSecretButtonMutation } from "./__generated__/DeleteSecretButtonMutation.graphql";

function DeleteSecretDialogContent({
  secretKey,
  onClose,
}: {
  secretKey: string;
  onClose: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const connectionId = ConnectionHandler.getConnectionID(
    "client:root",
    "SecretsCard_secrets"
  );

  const [commit, isCommitting] = useMutation<DeleteSecretButtonMutation>(
    graphql`
      mutation DeleteSecretButtonMutation(
        $input: DeleteSecretMutationInput!
        $connectionId: ID!
      ) {
        deleteSecret(input: $input) {
          id @deleteEdge(connections: [$connectionId])
          query {
            ...SecretsCard_data
          }
        }
      }
    `
  );

  const handleDelete = useCallback(() => {
    commit({
      variables: {
        input: {
          key: secretKey,
        },
        connectionId,
      },
      onCompleted: () => {
        notifySuccess({
          title: "Secret deleted",
          message: `Secret "${secretKey}" has been deleted successfully.`,
        });
        onClose();
      },
      onError: (error) => {
        const messages = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Failed to delete secret",
          message: messages?.join(", ") || "An unknown error occurred",
        });
      },
    });
  }, [commit, connectionId, notifyError, notifySuccess, secretKey, onClose]);

  return (
    <div>
      <View padding="size-200">
        <Text>
          Are you sure you want to delete secret <strong>{secretKey}</strong>?
          This action cannot be undone and may break custom providers that
          reference this secret.
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
            onPress={handleDelete}
            size="S"
            isDisabled={isCommitting}
          >
            Delete Secret
          </Button>
        </Flex>
      </View>
    </div>
  );
}

export function DeleteSecretButton({ secretKey }: { secretKey: string }) {
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
        aria-label="Delete secret"
        onPress={handleOpen}
        size="S"
      />
      <ModalOverlay>
        <Modal>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Secret</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <DeleteSecretDialogContent
                secretKey={secretKey}
                onClose={handleClose}
              />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
