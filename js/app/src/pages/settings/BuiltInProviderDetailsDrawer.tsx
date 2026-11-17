import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useNavigate, useParams } from "react-router";

import {
  Button,
  Dialog,
  Drawer,
  Flex,
  Icon,
  Icons,
  Skeleton,
  StatusIndicator,
  Text,
  View,
  ViewportModal,
  ViewportModalOverlay,
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
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { BuiltInProviderDetailsDrawerQuery } from "./__generated__/BuiltInProviderDetailsDrawerQuery.graphql";
import { formatModelTypes } from "./modelTypeUtils";
import { ProviderCredentialsDialog } from "./ProviderCredentialsDialog";
import {
  PROVIDER_DETAILS_DRAWER_DEFAULT_SIZE,
  PROVIDER_DETAILS_DRAWER_MIN_SIZE,
  ProviderDetailsSection,
  ProviderListSection,
} from "./ProviderDetailsSection";

const SETTINGS_PROVIDERS_PATH = "/settings/providers";

const detailsBodyCSS = css`
  overflow-y: auto;
  min-height: 0;
`;

/** Shown only when a model type's dependencies are missing, since that is what stops it running. */
function MissingDependencies({
  dependencies,
  dependenciesInstalled,
}: {
  dependencies: readonly string[];
  dependenciesInstalled: boolean;
}) {
  if (dependenciesInstalled || dependencies.length === 0) {
    return null;
  }
  return (
    <StatusIndicator
      category="unavailable"
      label="Not installed"
      detail={dependencies.join(", ")}
    />
  );
}

function BuiltInProviderDetailsFallback() {
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
          <Skeleton height={120} />
          <Skeleton height={160} />
        </Flex>
      </View>
    </DialogContent>
  );
}

function BuiltInProviderNotFound() {
  return (
    <DialogContent>
      <DialogHeader>
        <Flex direction="row" gap="size-200" alignItems="center">
          <DialogCloseButton slot="close" />
          <DialogTitle>Provider not found</DialogTitle>
        </Flex>
      </DialogHeader>
      <View padding="size-200">
        <Text color="text-700">This server has no such built-in provider.</Text>
      </View>
    </DialogContent>
  );
}

function BuiltInProviderDetailsContent({
  providerKey,
}: {
  providerKey: ModelProvider;
}) {
  const [isEditingCredentials, setIsEditingCredentials] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<BuiltInProviderDetailsDrawerQuery>(
    graphql`
      query BuiltInProviderDetailsDrawerQuery(
        $providerKey: GenerativeProviderKey!
      ) {
        modelProviders {
          key
          name
          modelTypes
          credentialsSet
          credentialRequirements {
            envVarName
            isRequired
          }
          chatDependencies: dependencies(modelType: CHAT)
          chatDependenciesInstalled: dependenciesInstalled(modelType: CHAT)
          decisionDependencies: dependencies(modelType: DECISION)
          decisionDependenciesInstalled: dependenciesInstalled(
            modelType: DECISION
          )
        }
        chatModels: playgroundModels(
          input: { providerKey: $providerKey, modelType: CHAT }
        ) {
          name
        }
        decisionModels: playgroundModels(
          input: { providerKey: $providerKey, modelType: DECISION }
        ) {
          name
        }
      }
    `,
    { providerKey },
    { fetchPolicy: "store-and-network", fetchKey }
  );
  const provider = data.modelProviders.find(
    (candidate) => candidate.key === providerKey
  );
  if (!provider) {
    return <BuiltInProviderNotFound />;
  }
  const servesChat = provider.modelTypes.includes("CHAT");
  const servesDecisions = provider.modelTypes.includes("DECISION");
  const envVarItems = provider.credentialRequirements.map((requirement) => ({
    name: requirement.envVarName,
    note: requirement.isRequired ? undefined : "optional",
  }));
  return (
    <DialogContent>
      <DialogHeader>
        <Flex direction="row" gap="size-200" alignItems="center">
          <DialogCloseButton slot="close" />
          <DialogTitle>
            <Flex direction="row" gap="size-100" alignItems="center">
              <GenerativeProviderIcon provider={provider.key} height={18} />
              {provider.name}
            </Flex>
          </DialogTitle>
        </Flex>
        <DialogTitleExtra>
          <Button
            size="S"
            leadingVisual={<Icon svg={<Icons.Edit />} />}
            aria-label={`Edit ${provider.name} credentials`}
            isDisabled={provider.credentialRequirements.length === 0}
            onPress={() => setIsEditingCredentials(true)}
          />
        </DialogTitleExtra>
      </DialogHeader>
      <ViewportModalOverlay
        isOpen={isEditingCredentials}
        onOpenChange={(isOpen) => {
          setIsEditingCredentials(isOpen);
          if (!isOpen) {
            // Saving credentials doesn't return the provider, so read it again.
            setFetchKey((key) => key + 1);
          }
        }}
      >
        <ViewportModal size="M">
          <ProviderCredentialsDialog provider={provider} />
        </ViewportModal>
      </ViewportModalOverlay>
      <div css={detailsBodyCSS}>
        <View padding="size-200">
          <Flex direction="column" gap="size-300">
            <ProviderDetailsSection
              title="Overview"
              details={[
                { label: "Type", value: { kind: "text", text: "Built-in" } },
                {
                  label: "Model types",
                  value: {
                    kind: "text",
                    text: formatModelTypes(provider.modelTypes),
                  },
                },
              ]}
            />
            <ProviderListSection
              title="Credentials"
              status={
                <StatusIndicator
                  category={provider.credentialsSet ? "succeeded" : "unset"}
                  label={
                    provider.credentialsSet
                      ? "Set on the server"
                      : "Not set on the server"
                  }
                />
              }
              items={envVarItems}
              emptyText="This provider needs no credentials."
              isMonospace
            />
            {servesChat ? (
              <ProviderListSection
                title="Chat models"
                isInline
                status={
                  <MissingDependencies
                    dependencies={provider.chatDependencies}
                    dependenciesInstalled={provider.chatDependenciesInstalled}
                  />
                }
                items={data.chatModels.map((model) => ({ name: model.name }))}
                emptyText="No models listed. Any model name the endpoint accepts works."
              />
            ) : null}
            {servesDecisions ? (
              <ProviderListSection
                title="Decision models"
                isInline
                status={
                  <MissingDependencies
                    dependencies={provider.decisionDependencies}
                    dependenciesInstalled={
                      provider.decisionDependenciesInstalled
                    }
                  />
                }
                items={data.decisionModels.map((model) => ({
                  name: model.name,
                }))}
                emptyText="No models listed. Any model name the endpoint accepts works."
              />
            ) : null}
          </Flex>
        </View>
      </div>
    </DialogContent>
  );
}

/**
 * Read-only view of a built-in provider's model types, credentials and
 * dependencies, opened from the AI providers table at
 * /settings/providers/built-in/:providerKey.
 */
export function BuiltInProviderDetailsDrawer() {
  const { providerKey } = useParams();
  const navigate = useNavigate();
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "settings-ai-provider-details",
  });
  return (
    <Drawer
      isOpen
      onClose={() => navigate(SETTINGS_PROVIDERS_PATH)}
      defaultSize={defaultSize ?? PROVIDER_DETAILS_DRAWER_DEFAULT_SIZE}
      minSize={PROVIDER_DETAILS_DRAWER_MIN_SIZE}
      onResize={onSizeChange}
    >
      <Dialog aria-label="AI provider details">
        {providerKey && isModelProvider(providerKey) ? (
          <Suspense fallback={<BuiltInProviderDetailsFallback />}>
            <BuiltInProviderDetailsContent providerKey={providerKey} />
          </Suspense>
        ) : (
          <BuiltInProviderNotFound />
        )}
      </Dialog>
    </Drawer>
  );
}
