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
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  View,
} from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { NewCustomProviderButtonCreateMutation } from "./__generated__/NewCustomProviderButtonCreateMutation.graphql";
import { ProviderForm } from "./CustomProviderForm";
import { transformToCreateInput } from "./customProviderFormUtils";

function NewProviderDialogContent({ onClose }: { onClose: () => void }) {
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const connectionId = ConnectionHandler.getConnectionID(
    "client:root",
    "CustomProvidersCard_generativeModelCustomProviders"
  );

  const [commit, isCommitting] =
    useMutation<NewCustomProviderButtonCreateMutation>(graphql`
      mutation NewCustomProviderButtonCreateMutation(
        $input: CreateGenerativeModelCustomProviderMutationInput!
        $connectionId: ID!
      ) {
        createGenerativeModelCustomProvider(input: $input) {
          provider
            @prependNode(
              connections: [$connectionId]
              edgeTypeName: "GenerativeModelCustomProviderEdge"
            ) {
            id
            name
            description
            provider
            createdAt
            updatedAt
          }
          query {
            ...CustomProvidersCard_data
          }
        }
      }
    `);

  const handleSubmit = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data: any) => {
      const input = transformToCreateInput(data);

      commit({
        variables: {
          input,
          connectionId,
        },
        onCompleted: () => {
          notifySuccess({
            title: "Provider created",
            message: `${data.name} has been created successfully.`,
          });
          onClose();
        },
        onError: (error) => {
          const messages = getErrorMessagesFromRelayMutationError(error);
          notifyError({
            title: "Failed to create provider",
            message: messages?.join(", ") || "An unknown error occurred",
          });
        },
      });
    },
    [commit, connectionId, notifyError, notifySuccess, onClose]
  );

  return (
    <View padding="size-200">
      <ProviderForm
        onSubmit={handleSubmit}
        onCancel={onClose}
        isSubmitting={isCommitting}
      />
    </View>
  );
}

export function NewProviderButton() {
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
        variant="primary"
        size="S"
        leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        aria-label="Create a new provider"
        onPress={handleOpen}
      >
        New Provider
      </Button>
      <ModalOverlay>
        <Modal size="L">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Custom Provider</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <NewProviderDialogContent onClose={handleClose} />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
