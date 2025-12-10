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
  const [error, setError] = useState<string | null>(null);
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
          id @deleteEdge(connections: [$connectionId])
          query {
            ...CustomProvidersCard_data
          }
        }
      }
    `);

  const handleDelete = useCallback(() => {
    // Clear any previous error when submitting
    setError(null);

    const providerName = provider.name;

    commit({
      variables: {
        input: {
          id: provider.id,
        },
        connectionId,
      },
      // Optimistic update: remove from list immediately
      optimisticUpdater: (store) => {
        const connection = store.get(connectionId);
        if (connection) {
          ConnectionHandler.deleteNode(connection, provider.id);
        }
      },
      onCompleted: () => {
        // Close modal and notify on success
        onClose();
        notifySuccess({
          title: "Provider deleted",
          message: `${providerName} has been deleted successfully.`,
        });
      },
      onError: (error) => {
        // Keep modal open on error so user understands what happened
        const messages = getErrorMessagesFromRelayMutationError(error);
        setError(messages?.join(", ") || "An unknown error occurred");
      },
    });
  }, [commit, connectionId, notifySuccess, provider, onClose]);

  return (
    <div>
      {error != null && (
        <Alert
          variant="danger"
          banner
          dismissable
          onDismissClick={() => setError(null)}
          title="Failed to delete provider"
        >
          {error}
        </Alert>
      )}
      <View padding="size-200">
        <Text color="danger">
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
          <Button
            variant="default"
            onPress={onClose}
            size="S"
            isDisabled={isCommitting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onPress={handleDelete}
            size="S"
            isDisabled={isCommitting}
          >
            {isCommitting ? "Deleting..." : "Delete Provider"}
          </Button>
        </Flex>
      </View>
    </div>
  );
}

export function DeleteCustomProviderButton({
  provider,
}: {
  provider: CustomProvider;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        variant="danger"
        leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
        aria-label="Delete provider"
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
                onClose={() => setIsOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
