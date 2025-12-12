import { Suspense, useCallback, useRef, useState } from "react";
import {
  graphql,
  PreloadedQuery,
  useMutation,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";

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
import {
  ProviderForm,
  type ProviderFormData,
  type ProviderFormRef,
} from "./CustomProviderForm";
import {
  type ProviderNode,
  transformConfigToFormValues,
  transformToPatchInput,
} from "./customProviderFormUtils";

const ProviderQuery = graphql`
  query EditCustomProviderButtonQuery($id: ID!) {
    node(id: $id) {
      ... on GenerativeModelCustomProviderOpenAI {
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
        }
      }
      ... on GenerativeModelCustomProviderAzureOpenAI {
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
              apiVersion
              azureEndpoint
              azureDeployment
              defaultHeaders
            }
          }
        }
      }
      ... on GenerativeModelCustomProviderAnthropic {
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
          ... on AnthropicCustomProviderConfig {
            anthropicAuthenticationMethod {
              apiKey
            }
            anthropicClientKwargs {
              baseUrl
              defaultHeaders
            }
          }
        }
      }
      ... on GenerativeModelCustomProviderAWSBedrock {
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
        }
      }
      ... on GenerativeModelCustomProviderGoogleGenAI {
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
  formRef,
}: {
  queryReference: PreloadedQuery<EditCustomProviderButtonQuery>;
  onClose: () => void;
  formRef: React.RefObject<ProviderFormRef | null>;
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
          # Refetch the list to ensure proper cache update when SDK/typename changes
          query {
            ...CustomProvidersCard_data
          }
        }
      }
    `);

  const nodeData = data?.node;

  // Validate that we have a valid provider node with required fields
  const providerData: ProviderNode | null =
    nodeData?.id && nodeData?.name && nodeData?.sdk
      ? (nodeData as ProviderNode)
      : null;

  const handleSubmit = useCallback(
    (formData: ProviderFormData) => {
      if (!providerData) return;

      const originalValues = transformConfigToFormValues(providerData);
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
    if (formRef.current?.isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to close?"
      );
      if (!confirmed) return;
    }
    onClose();
  }, [formRef, onClose]);

  if (!providerData) {
    return <Alert variant="danger">Provider not found</Alert>;
  }

  // Check if config has a parse error (corrupted/invalid config)
  if (providerData.config?.parseError) {
    return (
      <View padding="size-200">
        <Alert variant="danger">
          This provider&apos;s configuration could not be parsed and cannot be
          edited. Please delete this provider and create a new one.
          {providerData.config.parseError && (
            <div style={{ marginTop: 8, fontSize: "0.875em" }}>
              Error: {providerData.config.parseError}
            </div>
          )}
        </Alert>
      </View>
    );
  }

  return (
    <View padding="size-200">
      <ProviderForm
        ref={formRef}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        initialValues={transformConfigToFormValues(providerData)}
        isSubmitting={isCommitting}
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
  const formRef = useRef<ProviderFormRef>(null);
  const [queryReference, loadQuery, disposeQuery] =
    useQueryLoader<EditCustomProviderButtonQuery>(ProviderQuery);

  const handleOpen = () => {
    loadQuery({ id: providerId }, { fetchPolicy: "network-only" });
    setIsOpen(true);
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
    disposeQuery();
  }, [disposeQuery]);

  const handleCloseWithConfirmation = useCallback(() => {
    if (formRef.current?.isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to close?"
      );
      if (!confirmed) return;
    }
    handleClose();
  }, [handleClose]);

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
                    formRef={formRef}
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
