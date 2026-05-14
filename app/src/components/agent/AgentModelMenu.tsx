import { css } from "@emotion/react";
import { useMemo } from "react";
import {
  Autocomplete,
  Input,
  MenuSection,
  SubmenuTrigger,
  useFilter,
} from "react-aria-components";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Button,
  Flex,
  Menu,
  MenuContainer,
  MenuHeader,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
  SearchField,
  SearchIcon,
  SelectChevronUpDownIcon,
  Text,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import type {
  CustomProviderRef,
  ModelMenuProps,
  ModelMenuValue,
} from "@phoenix/components/generative/ModelMenu";
import { usePreferencesContext } from "@phoenix/contexts";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type {
  AgentModelMenuQuery,
  GenerativeModelSDK,
  GenerativeProviderKey,
} from "./__generated__/AgentModelMenuQuery.graphql";

const menuWidthCSS = css`
  min-width: 350px;

  &:focus-visible {
    outline: none;
  }
`;

type AgentBuiltInModelSelection = {
  provider: GenerativeProviderKey;
  modelName: string;
};

const AGENT_CURATED_BUILT_IN_MODELS: readonly AgentBuiltInModelSelection[] = [
  { provider: "ANTHROPIC", modelName: "claude-opus-4-6" },
  { provider: "ANTHROPIC", modelName: "claude-sonnet-4-6" },
  { provider: "OPENAI", modelName: "gpt-5.4" },
  { provider: "OPENAI", modelName: "gpt-5.4-mini" },
  { provider: "OPENAI", modelName: "gpt-5.5" },
];

type CustomProviderInfo = {
  id: string;
  name: string;
  sdk: GenerativeModelSDK;
  modelNames: readonly string[];
};

const SDK_TO_PROVIDER_KEY: Record<GenerativeModelSDK, GenerativeProviderKey> = {
  OPENAI: "OPENAI",
  AZURE_OPENAI: "AZURE_OPENAI",
  ANTHROPIC: "ANTHROPIC",
  AWS_BEDROCK: "AWS",
  GOOGLE_GENAI: "GOOGLE",
};

function applyBedrockPrefix(modelName: string, prefix: string): string {
  const prefixDot = `${prefix}.`;
  return modelName.startsWith(prefixDot)
    ? modelName
    : `${prefixDot}${modelName}`;
}

function getCuratedBuiltInModels(
  playgroundModels: AgentModelMenuQuery["response"]["playgroundModels"]
): AgentBuiltInModelSelection[] {
  const curatedModelKeys = new Set(
    AGENT_CURATED_BUILT_IN_MODELS.map(
      ({ provider, modelName }) => `${provider}:${modelName}`
    )
  );

  return AGENT_CURATED_BUILT_IN_MODELS.filter(({ provider, modelName }) =>
    playgroundModels.some(
      (
        playgroundModel: AgentModelMenuQuery["response"]["playgroundModels"][number]
      ) =>
        curatedModelKeys.has(`${provider}:${modelName}`) &&
        playgroundModel.providerKey === provider &&
        playgroundModel.name === modelName
    )
  );
}

function BuiltInModelItem({
  model,
  onChange,
}: {
  model: AgentBuiltInModelSelection;
  onChange?: (model: ModelMenuValue) => void;
}) {
  return (
    <MenuItem
      id={`${model.provider}:${model.modelName}`}
      textValue={model.modelName}
      onAction={() => {
        onChange?.({ provider: model.provider, modelName: model.modelName });
      }}
    >
      <Flex direction="row" gap="size-100" alignItems="center">
        <GenerativeProviderIcon provider={model.provider} height={16} />
        <Text>{model.modelName}</Text>
      </Flex>
    </MenuItem>
  );
}

function CustomProviderModelsSubmenu({
  providerKey,
  modelNames,
  customProvider,
  onChange,
}: {
  providerKey: GenerativeProviderKey;
  modelNames: readonly string[];
  customProvider: CustomProviderRef;
  onChange?: (model: ModelMenuValue) => void;
}) {
  const awsBedrockModelPrefix = usePreferencesContext(
    (state) => state.awsBedrockModelPrefix
  );
  const displayModelName = (name: string) =>
    providerKey === "AWS" && awsBedrockModelPrefix
      ? applyBedrockPrefix(name, awsBedrockModelPrefix)
      : name;
  const items = modelNames.map((modelName) => ({
    id: `${customProvider.id}:${modelName}`,
    textValue: displayModelName(modelName),
  }));
  const { contains } = useFilter();

  return (
    <MenuContainer placement="end top" shouldFlip>
      <Autocomplete filter={contains}>
        <MenuHeader>
          <SearchField
            aria-label="Search models"
            variant="quiet"
            size="L"
            autoFocus
          >
            <SearchIcon />
            <Input placeholder="Search models..." />
          </SearchField>
        </MenuHeader>
        <Menu items={items}>
          {(item) => (
            <MenuItem
              key={item.id}
              id={item.id}
              textValue={item.textValue}
              onAction={() => {
                onChange?.({
                  provider: providerKey,
                  modelName: item.textValue,
                  customProvider,
                });
              }}
            >
              <Flex direction="row" gap="size-100" alignItems="center">
                <GenerativeProviderIcon provider={providerKey} height={16} />
                <Text>{item.textValue}</Text>
              </Flex>
            </MenuItem>
          )}
        </Menu>
      </Autocomplete>
    </MenuContainer>
  );
}

/**
 * Assistant-specific model picker.
 *
 * Unlike the global model picker, this menu is intentionally opinionated:
 * curated built-in models are shown as a flat list, and custom providers are
 * grouped under a trailing section with provider-specific submenus.
 */
export function AgentModelMenu({
  value,
  onChange,
  placement,
  shouldFlip,
  variant = "default",
}: Omit<ModelMenuProps, "isDisabled">) {
  const isDisabled = useAgentContext((state) =>
    Object.values(state.chatStatusBySessionId).some(
      (status) => status === "submitted" || status === "streaming"
    )
  );
  const selectedProvider = value?.provider;
  const isValidSelectedProvider =
    selectedProvider && isModelProvider(selectedProvider);
  const triggerAriaLabel = value
    ? `Select model: ${value.modelName}`
    : "Select model";

  const data = useLazyLoadQuery<AgentModelMenuQuery>(
    graphql`
      query AgentModelMenuQuery {
        generativeModelCustomProviders {
          edges {
            node {
              id
              name
              sdk
              modelNames
            }
          }
        }
        playgroundModels {
          name
          providerKey
        }
      }
    `,
    {},
    { fetchPolicy: "store-and-network" }
  );

  const curatedBuiltInModels = useMemo(
    () => getCuratedBuiltInModels(data.playgroundModels),
    [data.playgroundModels]
  );

  const customProviders = useMemo(
    (): CustomProviderInfo[] =>
      data.generativeModelCustomProviders.edges.map(
        (
          edge: AgentModelMenuQuery["response"]["generativeModelCustomProviders"]["edges"][number]
        ) => ({
          id: edge.node.id,
          name: edge.node.name,
          sdk: edge.node.sdk,
          modelNames: edge.node.modelNames,
        })
      ),
    [data.generativeModelCustomProviders]
  );

  return (
    <MenuTrigger>
      <Button
        size="S"
        variant={variant}
        isDisabled={isDisabled}
        aria-label={triggerAriaLabel}
      >
        {value ? (
          <Flex direction="row" gap="size-100" alignItems="center">
            {isValidSelectedProvider && (
              <GenerativeProviderIcon provider={selectedProvider} height={16} />
            )}
            <Text>{value.modelName}</Text>
          </Flex>
        ) : (
          <Text color="text-700">Select a model</Text>
        )}
        {variant !== "quiet" && <SelectChevronUpDownIcon />}
      </Button>
      <MenuContainer
        minHeight={0}
        placement={placement}
        shouldFlip={shouldFlip}
      >
        <Menu css={menuWidthCSS}>
          {curatedBuiltInModels.length > 0 ? (
            <>
              {curatedBuiltInModels.map((model) => (
                <BuiltInModelItem
                  key={`${model.provider}:${model.modelName}`}
                  model={model}
                  onChange={onChange}
                />
              ))}
            </>
          ) : (
            <MenuItem
              id="no-curated-models"
              textValue="No curated models"
              isDisabled
            >
              <Text color="text-700">No curated models available</Text>
            </MenuItem>
          )}

          {customProviders.length > 0 && (
            <MenuSection>
              <MenuSectionTitle title="Custom Providers" />
              {customProviders.map((customProvider) => {
                const providerKey = SDK_TO_PROVIDER_KEY[customProvider.sdk];
                return (
                  <SubmenuTrigger key={customProvider.id}>
                    <MenuItem
                      id={`custom-provider:${customProvider.id}`}
                      textValue={customProvider.name}
                    >
                      <Flex direction="row" gap="size-100" alignItems="center">
                        <GenerativeProviderIcon
                          provider={providerKey}
                          height={16}
                        />
                        <Text>{customProvider.name}</Text>
                      </Flex>
                    </MenuItem>
                    <CustomProviderModelsSubmenu
                      providerKey={providerKey}
                      modelNames={customProvider.modelNames}
                      customProvider={{
                        id: customProvider.id,
                        name: customProvider.name,
                      }}
                      onChange={onChange}
                    />
                  </SubmenuTrigger>
                );
              })}
            </MenuSection>
          )}
        </Menu>
      </MenuContainer>
    </MenuTrigger>
  );
}
