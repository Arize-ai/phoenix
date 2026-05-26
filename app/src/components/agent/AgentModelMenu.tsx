import { css } from "@emotion/react";
import { useCallback, useMemo } from "react";
import { MenuSection } from "react-aria-components";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Button,
  Flex,
  Menu,
  MenuContainer,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
  SelectChevronUpDownIcon,
  Separator,
  Text,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import type {
  CustomProviderInfo,
  ModelMenuProps,
  ModelMenuValue,
} from "@phoenix/components/generative/ModelMenu";
import {
  getModelsByProvider,
  ProviderModelMenuItems,
} from "@phoenix/components/generative/ModelMenu";
import { usePreferencesContext } from "@phoenix/contexts";
import { useAgentContext } from "@phoenix/contexts/AgentContext";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { AgentModelMenuQuery } from "./__generated__/AgentModelMenuQuery.graphql";
import {
  getCuratedBuiltInModels,
  isAgentCuratedBuiltInModel,
} from "./agentCuratedModels";

const menuWidthCSS = css`
  min-width: 350px;

  &:focus-visible {
    outline: none;
  }
`;

function applyBedrockPrefix(modelName: string, prefix: string): string {
  const prefixDot = `${prefix}.`;
  return modelName.startsWith(prefixDot)
    ? modelName
    : `${prefixDot}${modelName}`;
}

function AgentModelItem({
  model,
  onChange,
}: {
  model: ModelMenuValue;
  onChange?: (model: ModelMenuValue) => void;
}) {
  return (
    <MenuItem
      id={`${model.customProvider?.id ?? model.provider}:${model.modelName}`}
      textValue={model.modelName}
      onAction={() => {
        onChange?.(model);
      }}
    >
      <Flex direction="row" gap="size-100" alignItems="center">
        <GenerativeProviderIcon provider={model.provider} height={16} />
        <Text>{model.modelName}</Text>
      </Flex>
    </MenuItem>
  );
}

function CuratedAndOtherModelMenuSections({
  curatedBuiltInModels,
  modelsByProvider,
  customProviders,
  modelProviders,
  onChange,
}: {
  curatedBuiltInModels: ModelMenuValue[];
  modelsByProvider: Map<string, string[]>;
  customProviders: CustomProviderInfo[];
  modelProviders: AgentModelMenuQuery["response"]["modelProviders"];
  onChange?: (model: ModelMenuValue) => void;
}) {
  return (
    <>
      <MenuSection>
        <MenuSectionTitle title="Recommended" />
        {curatedBuiltInModels.map((model) => (
          <AgentModelItem
            key={`${model.provider}:${model.modelName}`}
            model={model}
            onChange={onChange}
          />
        ))}
      </MenuSection>
      <Separator />
      <MenuSection>
        <MenuSectionTitle title="Other models" />
        <ProviderModelMenuItems
          providers={modelProviders}
          modelsByProvider={modelsByProvider}
          customProviders={customProviders}
          onChange={onChange}
        />
      </MenuSection>
    </>
  );
}

/**
 * Assistant-specific model picker.
 *
 * Unlike the global model picker, this menu is intentionally opinionated.
 * By default it stays flat and limited to curated built-in models. Settings
 * can opt out to expose the broader provider/model universe in sections.
 */
export function AgentModelMenu({
  value,
  onChange,
  placement,
  shouldFlip,
  variant = "default",
  limitToCuratedModels = true,
}: Omit<ModelMenuProps, "isDisabled"> & {
  limitToCuratedModels?: boolean;
}) {
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
  const awsBedrockModelPrefix = usePreferencesContext(
    (state) => state.awsBedrockModelPrefix
  );

  const handleModelChange = useCallback(
    (model: ModelMenuValue) => {
      if (model.provider === "AWS" && awsBedrockModelPrefix) {
        onChange?.({
          ...model,
          modelName: applyBedrockPrefix(model.modelName, awsBedrockModelPrefix),
        });
      } else {
        onChange?.(model);
      }
    },
    [onChange, awsBedrockModelPrefix]
  );

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
        modelProviders {
          key
          name
          dependenciesInstalled
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

  const modelsByProvider = useMemo(
    () =>
      getModelsByProvider(
        data.playgroundModels.filter(
          (model) =>
            !isAgentCuratedBuiltInModel({
              provider: model.providerKey,
              modelName: model.name,
            })
        )
      ),
    [data.playgroundModels]
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
          {limitToCuratedModels ? (
            curatedBuiltInModels.map((model) => (
              <AgentModelItem
                key={`${model.provider}:${model.modelName}`}
                model={model}
                onChange={handleModelChange}
              />
            ))
          ) : (
            <CuratedAndOtherModelMenuSections
              curatedBuiltInModels={curatedBuiltInModels}
              modelsByProvider={modelsByProvider}
              customProviders={customProviders}
              modelProviders={data.modelProviders}
              onChange={handleModelChange}
            />
          )}
        </Menu>
      </MenuContainer>
    </MenuTrigger>
  );
}
