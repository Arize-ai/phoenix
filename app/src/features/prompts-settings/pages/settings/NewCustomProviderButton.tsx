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
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  View,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { NewCustomProviderButtonCreateMutation } from "./__generated__/NewCustomProviderButtonCreateMutation.graphql";
import { ProviderForm, type ProviderFormData } from "./CustomProviderForm";
import { transformToCreateInput } from "./customProviderFormUtils";

function NewProviderDialogContent({ onClose }: { onClose: () => void }) {
  const notifySuccess = useNotifySuccess();
  const [error, setError] = useState<string | null>(null);
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
            sdk
            provider
            createdAt
            updatedAt
            user {
              id
              username
              profilePictureUrl
            }
          }
        }
      }
    `);

  const handleSubmit = useCallback(
    (data: ProviderFormData) => {
      // Clear any previous error when submitting
      setError(null);

      const input = transformToCreateInput(data);
      const providerName = data.name;

      commit({
        variables: {
          input,
          connectionId,
        },
        onCompleted: () => {
          // Close modal only after successful completion
          onClose();
          notifySuccess({
            title: "Provider created",
            message: `${providerName} has been created successfully.`,
          });
        },
        onError: (error) => {
          // Keep modal open on error so user can retry
          const messages = getErrorMessagesFromRelayMutationError(error);
          setError(messages?.join(", ") || "An unknown error occurred");
        },
      });
    },
    [commit, connectionId, notifySuccess, onClose]
  );

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <>
      {error != null && (
        <Alert
          variant="danger"
          banner
          dismissable
          onDismissClick={() => setError(null)}
          title="Failed to create provider"
        >
          {error}
        </Alert>
      )}
      <View padding="size-200">
        <ProviderForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isCommitting}
        />
      </View>
    </>
  );
}

export function NewCustomProviderButton() {
  const [isOpen, setIsOpen] = useState(false);
  const handleClose = useCallback(() => setIsOpen(false), []);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        variant="primary"
        size="S"
        leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        aria-label="Create a new provider"
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
