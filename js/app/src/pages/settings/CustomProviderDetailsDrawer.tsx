import { css } from "@emotion/react";
import { Suspense } from "react";
import { graphql, useFragment, useLazyLoadQuery } from "react-relay";
import { useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Alert,
  Dialog,
  Drawer,
  Flex,
  Skeleton,
  Text,
  View,
  VisuallyHidden,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { useDefaultDrawerSize } from "@phoenix/components/core/overlay";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { SDK_LABELS } from "@phoenix/constants/generativeConstants";

import type { CustomProviderDetailsDrawer_provider$key } from "./__generated__/CustomProviderDetailsDrawer_provider.graphql";
import type { CustomProviderDetailsDrawerQuery } from "./__generated__/CustomProviderDetailsDrawerQuery.graphql";
import { listCustomProviderConfigDetails } from "./customProviderDetailsUtils";
import { resolveProviderIconKey } from "./customProviderIcon";
import { EditCustomProviderButton } from "./EditCustomProviderButton";
import { formatModelTypes } from "./modelTypeUtils";
import {
  PROVIDER_DETAILS_DRAWER_DEFAULT_SIZE,
  PROVIDER_DETAILS_DRAWER_MIN_SIZE,
  ProviderDetailsSection,
  type ProviderDetailValue,
  ProviderListSection,
} from "./ProviderDetailsSection";

const SETTINGS_PROVIDERS_PATH = "/settings/providers";

const detailsBodyCSS = css`
  overflow-y: auto;
  min-height: 0;
`;

function text(value: string): ProviderDetailValue {
  return { kind: "text", text: value };
}

function CustomProviderDetailsFallback() {
  return (
    <DialogContent>
      <VisuallyHidden role="status">Loading provider details</VisuallyHidden>
      <DialogHeader>
        <Flex direction="row" gap="size-200" alignItems="center">
          <DialogCloseButton slot="close" />
          <Skeleton width={200} height={24} />
        </Flex>
      </DialogHeader>
      <View padding="size-200">
        <Flex direction="column" gap="size-300">
          <Skeleton height={48} />
          <Skeleton height={160} />
          <Skeleton height={120} />
        </Flex>
      </View>
    </DialogContent>
  );
}

function CustomProviderDetailsContent({ providerId }: { providerId: string }) {
  const data = useLazyLoadQuery<CustomProviderDetailsDrawerQuery>(
    graphql`
      query CustomProviderDetailsDrawerQuery($id: ID!) {
        node(id: $id) {
          __typename
          ... on GenerativeModelCustomProvider {
            ...CustomProviderDetailsDrawer_provider
          }
        }
      }
    `,
    { id: providerId },
    { fetchPolicy: "store-and-network" }
  );
  if (data.node.__typename !== "GenerativeModelCustomProvider") {
    return (
      <DialogContent>
        <DialogHeader>
          <Flex direction="row" gap="size-200" alignItems="center">
            <DialogCloseButton slot="close" />
            <DialogTitle>Provider not found</DialogTitle>
          </Flex>
        </DialogHeader>
        <View padding="size-200">
          <Text color="text-700">
            This custom provider doesn&apos;t exist. It may have been deleted.
          </Text>
        </View>
      </DialogContent>
    );
  }
  return <CustomProviderDetails provider={data.node} />;
}

function CustomProviderDetails({
  provider: providerKey,
}: {
  provider: CustomProviderDetailsDrawer_provider$key;
}) {
  const provider = useFragment<CustomProviderDetailsDrawer_provider$key>(
    graphql`
      fragment CustomProviderDetailsDrawer_provider on GenerativeModelCustomProvider {
        id
        name
        description
        provider
        sdk
        createdAt
        updatedAt
        user {
          username
        }
        modelTypes
        models {
          chat {
            names
          }
          decision {
            names
          }
        }
        chatModelNames: modelNames(modelType: CHAT)
        decisionModelNames: modelNames(modelType: DECISION)
        config {
          __typename
          ... on UnparsableConfig {
            parseError
          }
          ... on OpenAICustomProviderConfig {
            openaiApiType
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
            openaiApiType
            azureOpenaiAuthenticationMethod {
              apiKey
              azureAdTokenProvider {
                azureTenantId
                azureClientId
                azureClientSecret
                scope
              }
              defaultCredentials
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
              accessKeys {
                awsAccessKeyId
                awsSecretAccessKey
                awsSessionToken
              }
              defaultCredentials
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
          ... on TypeSafeCustomProviderConfig {
            typesafeAuthenticationMethod {
              apiKey
            }
            typesafeClientKwargs {
              baseUrl
              defaultHeaders
            }
          }
        }
      }
    `,
    providerKey
  );
  const iconProviderKey = resolveProviderIconKey({
    providerString: provider.provider,
    sdk: provider.sdk,
  });
  const noModelsText =
    "No models listed. Any model name the endpoint accepts works.";
  return (
    <DialogContent>
      <DialogHeader>
        <Flex direction="row" gap="size-200" alignItems="center">
          <DialogCloseButton slot="close" />
          <DialogTitle>
            <Flex direction="row" gap="size-100" alignItems="center">
              <GenerativeProviderIcon provider={iconProviderKey} height={18} />
              {provider.name}
            </Flex>
          </DialogTitle>
        </Flex>
        <DialogTitleExtra>
          <EditCustomProviderButton
            providerId={provider.id}
            providerName={provider.name}
          />
        </DialogTitleExtra>
      </DialogHeader>
      <div css={detailsBodyCSS}>
        <View padding="size-200">
          <Flex direction="column" gap="size-300">
            {provider.description ? (
              <Text size="S" color="text-700">
                {provider.description}
              </Text>
            ) : null}
            <ProviderDetailsSection
              title="Overview"
              details={[
                { label: "Type", value: text("Custom") },
                {
                  label: "Provider string",
                  value: { kind: "code", text: provider.provider },
                },
                { label: "SDK", value: text(SDK_LABELS[provider.sdk]) },
                {
                  label: "Model types",
                  value: text(formatModelTypes(provider.modelTypes)),
                },
              ]}
            />
            {provider.config.__typename === "UnparsableConfig" ? (
              <Alert variant="danger" title="Configuration could not be read">
                Edit this provider to enter a new configuration.
              </Alert>
            ) : (
              <ProviderDetailsSection
                title="Connection"
                details={listCustomProviderConfigDetails(provider.config)}
              />
            )}
            {provider.models.chat ? (
              <ProviderListSection
                title="Chat models"
                isInline
                items={provider.chatModelNames.map((name) => ({ name }))}
                emptyText={noModelsText}
              />
            ) : null}
            {provider.models.decision ? (
              <ProviderListSection
                title="Decision models"
                isInline
                items={provider.decisionModelNames.map((name) => ({ name }))}
                emptyText={noModelsText}
              />
            ) : null}
            <ProviderDetailsSection
              title="History"
              details={[
                ...(provider.user
                  ? [
                      {
                        label: "Created by",
                        value: text(provider.user.username),
                      },
                    ]
                  : []),
                {
                  label: "Created",
                  value: text(new Date(provider.createdAt).toLocaleString()),
                },
                {
                  label: "Updated",
                  value: text(new Date(provider.updatedAt).toLocaleString()),
                },
              ]}
            />
          </Flex>
        </View>
      </div>
    </DialogContent>
  );
}

/**
 * Read-only view of a custom provider's settings, opened from the custom
 * providers table at /settings/providers/custom/:providerId.
 */
export function CustomProviderDetailsDrawer() {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "settings-ai-provider-details",
  });
  invariant(providerId, "providerId is required");
  return (
    <Drawer
      isOpen
      onClose={() => navigate(SETTINGS_PROVIDERS_PATH)}
      defaultSize={defaultSize ?? PROVIDER_DETAILS_DRAWER_DEFAULT_SIZE}
      minSize={PROVIDER_DETAILS_DRAWER_MIN_SIZE}
      onResize={onSizeChange}
    >
      <Dialog aria-label="Custom provider details">
        <Suspense fallback={<CustomProviderDetailsFallback />}>
          <CustomProviderDetailsContent providerId={providerId} />
        </Suspense>
      </Dialog>
    </Drawer>
  );
}
