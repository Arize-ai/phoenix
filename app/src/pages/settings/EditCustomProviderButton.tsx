import { useCallback } from "react";
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
  onCancel,
  onClose,
}: {
  provider: CustomProvider;
  onCancel: () => void;
  onClose: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

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

      commit({
        variables: {
          input,
        },
        onCompleted: () => {
          notifySuccess({
            title: "Provider updated",
            message: `${data.name} has been updated successfully.`,
          });
          onClose();
        },
        onError: (error) => {
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

  return (
    <View padding="size-200">
      <ProviderForm
        onSubmit={handleSubmit}
        onCancel={onCancel}
        initialValues={transformConfigToFormValues(provider)}
        isSubmitting={isCommitting}
      />
    </View>
  );
}

export function EditProviderButton({ provider }: { provider: CustomProvider }) {
  return (
    <DialogTrigger>
      <Button
        variant="default"
        leadingVisual={<Icon svg={<Icons.EditOutline />} />}
        aria-label="Edit provider"
        size="S"
      />
      <ModalOverlay>
        <Modal size="L">
          <Dialog>
            {({ close }) => (
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit {provider.name}</DialogTitle>
                  <DialogTitleExtra>
                    <DialogCloseButton slot="close" />
                  </DialogTitleExtra>
                </DialogHeader>
                <EditProviderDialogContent
                  provider={provider}
                  onCancel={close}
                  onClose={close}
                />
              </DialogContent>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
