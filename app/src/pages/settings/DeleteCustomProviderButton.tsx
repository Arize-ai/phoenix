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

import type { CustomProvidersCard_data$data } from "./__generated__/CustomProvidersCard_data.graphql";
import type { DeleteCustomProviderButtonMutation } from "./__generated__/DeleteCustomProviderButtonMutation.graphql";

type CustomProvider =
  CustomProvidersCard_data$data["generativeModelCustomProviders"]["edges"][number]["node"];

function DeleteProviderDialogContent({
  provider,
  onClose,
}: {
  provider: CustomProvider;
  onClose: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const connectionId = ConnectionHandler.getConnectionID(
    "client:root",
    "CustomProvidersCard_generativeModelCustomProviders"
  );

  const [commit, isCommitting] =
    useMutation<DeleteCustomProviderButtonMutation>(graphql`
      mutation DeleteCustomProviderButtonMutation(
        $input: DeleteGenerativeModelCustomProviderMutationInput!
        $connectionId: ID!
      ) {
        deleteGenerativeModelCustomProvider(input: $input) {
          deletedProviderId @deleteEdge(connections: [$connectionId])
          query {
            ...CustomProvidersCard_data
          }
        }
      }
    `);

  const handleDelete = useCallback(() => {
    commit({
      variables: {
        input: {
          id: provider.id,
        },
        connectionId,
      },
      onCompleted: () => {
        notifySuccess({
          title: "Provider deleted",
          message: `${provider.name} has been deleted successfully.`,
        });
        onClose();
      },
      onError: (error) => {
        const messages = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Failed to delete provider",
          message: messages?.join(", ") || "An unknown error occurred",
        });
      },
    });
  }, [commit, connectionId, notifyError, notifySuccess, provider, onClose]);

  return (
    <div>
      <View padding="size-200">
        <Text>
          Are you sure you want to delete <strong>{provider.name}</strong>? This
          action cannot be undone.
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
            Delete Provider
          </Button>
        </Flex>
      </View>
    </div>
  );
}

export function DeleteProviderButton({
  provider,
}: {
  provider: CustomProvider;
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
        aria-label="Delete provider"
        onPress={handleOpen}
        size="S"
      />
      <ModalOverlay>
        <Modal>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Provider</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <DeleteProviderDialogContent
                provider={provider}
                onClose={handleClose}
              />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
