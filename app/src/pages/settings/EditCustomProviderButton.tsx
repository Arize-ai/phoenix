import { Suspense, useCallback, useState } from "react";
import {
  graphql,
  PreloadedQuery,
  useMutation,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";
import invariant from "tiny-invariant";

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
  Loading,
  Modal,
  ModalOverlay,
  View,
} from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { EditCustomProviderButtonPatchMutation } from "./__generated__/EditCustomProviderButtonPatchMutation.graphql";
import { EditCustomProviderButtonQuery } from "./__generated__/EditCustomProviderButtonQuery.graphql";
import { ProviderForm, type ProviderFormData } from "./CustomProviderForm";
import {
  createDefaultFormData,
  transformConfigToFormValues,
  transformToPatchInput,
} from "./customProviderFormUtils";

const ProviderQuery = graphql`
  query EditCustomProviderButtonQuery($id: ID!) {
    node(id: $id) {
      __typename
      ... on GenerativeModelCustomProvider {
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
        config {
          ... on UnparsableConfig {
            parseError
          }
          ... on OpenAICustomProviderConfig {
            openaiAuthenticationMethod {
              apiKey
            }
            openaiClientKwargs {
              baseUrl
              organization
              project
              defaultHeaders
            }
          }
          ... on AzureOpenAICustomProviderConfig {
            azureOpenaiAuthenticationMethod {
              apiKey
              azureAdTokenProvider {
                azureTenantId
                azureClientId
                azureClientSecret
                scope
              }
            }
            azureOpenaiClientKwargs {
              azureEndpoint
              defaultHeaders
            }
          }
          ... on AnthropicCustomProviderConfig {
            anthropicAuthenticationMethod {
              apiKey
            }
            anthropicClientKwargs {
              baseUrl
              defaultHeaders
            }
          }
          ... on AWSBedrockCustomProviderConfig {
            awsBedrockAuthenticationMethod {
              awsAccessKeyId
              awsSecretAccessKey
              awsSessionToken
            }
            awsBedrockClientKwargs {
              regionName
              endpointUrl
            }
          }
          ... on GoogleGenAICustomProviderConfig {
            googleGenaiAuthenticationMethod {
              apiKey
            }
            googleGenaiClientKwargs {
              httpOptions {
                baseUrl
                headers
              }
            }
          }
        }
      }
    }
  }
`;

function EditCustomProviderDialogContent({
  queryReference,
  onClose,
  shouldShowConfirmation,
  setShouldShowConfirmation,
}: {
  queryReference: PreloadedQuery<EditCustomProviderButtonQuery>;
  onClose: () => void;
  shouldShowConfirmation: boolean;
  setShouldShowConfirmation: (shouldShowConfirmation: boolean) => void;
}) {
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const data = usePreloadedQuery<EditCustomProviderButtonQuery>(
    ProviderQuery,
    queryReference
  );

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
          # Refetch the list to update the providers table
          query {
            ...CustomProvidersCard_data
          }
        }
      }
    `);

  invariant(
    data.node.__typename === "GenerativeModelCustomProvider",
    "Node is not a generative model custom provider"
  );
  const providerData = data.node;

  const handleSubmit = useCallback(
    (formData: ProviderFormData) => {
      if (!providerData) return;

      // When config has a parse error, use default form values as the baseline
      // so that transformToPatchInput will include all the new config fields
      const originalValues = providerData.config?.parseError
        ? {
            ...createDefaultFormData(providerData.sdk),
            name: providerData.name,
            description: providerData.description || "",
            provider: providerData.provider,
          }
        : transformConfigToFormValues(providerData);
      const input = transformToPatchInput(
        formData,
        providerData.id,
        originalValues
      );
      const providerName = formData.name;

      commit({
        variables: {
          input,
        },
        onCompleted: () => {
          onClose();
          notifySuccess({
            title: "Provider updated",
            message: `${providerName} has been updated successfully.`,
          });
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
    [commit, notifyError, notifySuccess, providerData, onClose]
  );

  const handleCancel = useCallback(() => {
    if (shouldShowConfirmation) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to close?"
      );
      if (!confirmed) return;
    }
    onClose();
  }, [shouldShowConfirmation, onClose]);

  if (!providerData) {
    return <Alert variant="danger">Provider not found</Alert>;
  }

  // Check if config has a parse error (corrupted/invalid config)
  // In this case, show a blank form with default values for the SDK type
  const hasParseError = Boolean(providerData.config?.parseError);
  const initialValues = hasParseError
    ? {
        ...createDefaultFormData(providerData.sdk),
        name: providerData.name,
        description: providerData.description || "",
        provider: providerData.provider,
      }
    : transformConfigToFormValues(providerData);

  return (
    <View padding="size-200">
      {hasParseError && (
        <View paddingBottom="size-200">
          <Alert variant="warning">
            This provider&apos;s configuration could not be parsed. Please enter
            a new configuration below.
            {providerData.config?.parseError && (
              <div style={{ marginTop: 8, fontSize: "0.875em" }}>
                Error: {providerData.config.parseError}
              </div>
            )}
          </Alert>
        </View>
      )}
      <ProviderForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        initialValues={initialValues}
        isSubmitting={isCommitting}
        onDirtyChange={setShouldShowConfirmation}
      />
    </View>
  );
}

export function EditCustomProviderButton({
  providerId,
  providerName,
}: {
  providerId: string;
  providerName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldShowConfirmation, setShouldShowConfirmation] = useState(false);
  const [queryReference, loadQuery, disposeQuery] =
    useQueryLoader<EditCustomProviderButtonQuery>(ProviderQuery);

  const handleOpen = () => {
    loadQuery({ id: providerId }, { fetchPolicy: "network-only" });
    setShouldShowConfirmation(false); // Reset stale dirty state from previous session
    setIsOpen(true);
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
    disposeQuery();
  }, [disposeQuery]);

  const handleCloseWithConfirmation = useCallback(() => {
    if (shouldShowConfirmation) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to close?"
      );
      if (!confirmed) return;
    }
    handleClose();
  }, [handleClose, shouldShowConfirmation]);

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleCloseWithConfirmation();
      }}
    >
      <Button
        variant="default"
        leadingVisual={<Icon svg={<Icons.EditOutline />} />}
        aria-label="Edit provider"
        onPress={handleOpen}
        size="S"
      />
      <ModalOverlay>
        <Modal size="L">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit {providerName}</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <Suspense fallback={<Loading />}>
                {queryReference ? (
                  <EditCustomProviderDialogContent
                    queryReference={queryReference}
                    onClose={handleClose}
                    shouldShowConfirmation={shouldShowConfirmation}
                    setShouldShowConfirmation={setShouldShowConfirmation}
                  />
                ) : (
                  <Loading />
                )}
              </Suspense>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
