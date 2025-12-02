import { useCallback, useRef, useState } from "react";
import { graphql, useMutation } from "react-relay";

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

import type { CustomProvidersCard_data$data } from "./__generated__/CustomProvidersCard_data.graphql";
import type { EditCustomProviderButtonPatchMutation } from "./__generated__/EditCustomProviderButtonPatchMutation.graphql";
import { ProviderForm, type ProviderFormData } from "./CustomProviderForm";
import {
  transformConfigToFormValues,
  transformToPatchInput,
} from "./customProviderFormUtils";

type CustomProvider =
  CustomProvidersCard_data$data["generativeModelCustomProviders"]["edges"][number]["node"];

function EditProviderDialogContent({
  provider,
  onClose,
}: {
  provider: CustomProvider;
  onClose: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const isDirtyRef = useRef(false);

  const [commit, isCommitting] =
    useMutation<EditCustomProviderButtonPatchMutation>(graphql`
      mutation EditCustomProviderButtonPatchMutation(
        $input: PatchGenerativeModelCustomProviderMutationInput!
      ) {
        patchGenerativeModelCustomProvider(input: $input) {
          provider {
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
    (data: ProviderFormData) => {
      const originalValues = transformConfigToFormValues(provider);
      const input = transformToPatchInput(data, provider.id, originalValues);
      const providerName = data.name;

      commit({
        variables: {
          input,
        },
        onCompleted: () => {
          // Close modal only after successful completion
          onClose();
          notifySuccess({
            title: "Provider updated",
            message: `${providerName} has been updated successfully.`,
          });
        },
        onError: (error) => {
          // Keep modal open on error so user can retry
          const messages = getErrorMessagesFromRelayMutationError(error);
          notifyError({
            title: "Failed to update provider",
            message: messages?.join(", ") || "An unknown error occurred",
          });
        },
      });
    },
    [commit, notifyError, notifySuccess, provider, onClose]
  );

  const handleCancel = useCallback(() => {
    if (isDirtyRef.current) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to close?"
      );
      if (!confirmed) return;
    }
    onClose();
  }, [onClose]);

  const handleDirtyStateChange = useCallback((isDirty: boolean) => {
    isDirtyRef.current = isDirty;
  }, []);

  return (
    <View padding="size-200">
      <ProviderForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        initialValues={transformConfigToFormValues(provider)}
        isSubmitting={isCommitting}
        onDirtyStateChange={handleDirtyStateChange}
      />
    </View>
  );
}

export function EditProviderButton({ provider }: { provider: CustomProvider }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        variant="default"
        leadingVisual={<Icon svg={<Icons.EditOutline />} />}
        aria-label="Edit provider"
        size="S"
      />
      <ModalOverlay>
        <Modal size="L">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit {provider.name}</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <EditProviderDialogContent
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
