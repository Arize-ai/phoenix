import { css } from "@emotion/react";
import { useCallback, useMemo, useState } from "react";
import {
  MenuSection,
  type PopoverProps,
  SubmenuTrigger,
} from "react-aria-components";

import {
  Autocomplete,
  Button,
  Flex,
  Icon,
  Icons,
  Input,
  LinkButton,
  Menu,
  MenuContainer,
  MenuFooter,
  MenuHeader,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
  SearchField,
  Text,
  useFilter,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchIcon } from "@phoenix/components/core/field";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import {
  applyBedrockModelPrefix,
  getProviderKeyForGenerativeModelSDK,
} from "@phoenix/components/generative/modelProviderUtils";
import {
  type CustomProviderInfo,
  type GenerativeProviderKey,
  type ModelProviderInfo,
  useModelMenuData,
} from "@phoenix/components/generative/useModelMenuData";
import { usePreferencesContext } from "@phoenix/contexts";
import { assertUnreachable } from "@phoenix/typeUtils";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

const menuWidthCSS = css`
  min-width: 350px;
`;

/**
 * Reference to a custom provider.
 */
export type CustomProviderRef = {
  id: string;
  name: string;
};

export type ModelMenuValue = {
  provider: GenerativeProviderKey;
  modelName: string;
  /**
   * Reference to custom provider if using one
   */
  customProvider?: CustomProviderRef;
};

/**
 * Delimiter used to separate parts of menu keys.
 * Using a Private Use Area (PUA) character unlikely to appear in provider IDs or model names.
 */
const KEY_DELIMITER = "\uE000";

type BuiltinModelInfo = {
  type: "builtin";
  providerKey: string;
  modelName: string;
};

type CustomModelInfo = {
  type: "custom";
  customProviderId: string;
  modelName: string;
};

type ModelInfo = BuiltinModelInfo | CustomModelInfo;

/**
 * Encodes a menu key for a built-in provider model
 */
function encodeBuiltInKey({
  providerKey,
  modelName,
}: {
  providerKey: string;
  modelName: string;
}): string {
  return `builtin${KEY_DELIMITER}${providerKey}${KEY_DELIMITER}${modelName}`;
}

/**
 * Encodes a menu key for a custom provider model
 */
function encodeCustomKey({
  customProviderId,
  modelName,
}: {
  customProviderId: string;
  modelName: string;
}): string {
  return `custom${KEY_DELIMITER}${customProviderId}${KEY_DELIMITER}${modelName}`;
}

/**
 * Decodes a menu key string into its components.
 * Uses indexOf to handle model names that may contain the delimiter.
 */
function decodeMenuKey(key: string): ModelInfo | null {
  const firstDelim = key.indexOf(KEY_DELIMITER);
  if (firstDelim === -1) {
    return null;
  }

  const secondDelim = key.indexOf(KEY_DELIMITER, firstDelim + 1);
  if (secondDelim === -1) {
    return null;
  }

  const type = key.slice(0, firstDelim);
  const id = key.slice(firstDelim + 1, secondDelim);
  const modelName = key.slice(secondDelim + 1);

  switch (type) {
    case "custom":
      return { type: "custom", customProviderId: id, modelName };
    case "builtin":
      return { type: "builtin", providerKey: id, modelName };
    default:
      return null;
  }
}

/**
 * Prepends an AWS Bedrock cross-region inference prefix to a model name.
 * Idempotent: returns the name unchanged if it already starts with "{prefix}.".
 */
export type ModelMenuProps = Pick<PopoverProps, "placement" | "shouldFlip"> & {
  value?: ModelMenuValue | null;
  onChange?: (model: ModelMenuValue) => void;
  isDisabled?: boolean;
  /**
   * Visual variant of the trigger button.
   * - `"default"` — standard bordered button.
   * - `"quiet"` — borderless button.
   * @default "default"
   */
  variant?: "default" | "quiet";
};

export function ModelMenu({
  value,
  onChange,
  isDisabled = false,
  placement,
  shouldFlip,
  variant = "default",
}: ModelMenuProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const [searchValue, setSearchValue] = useState("");
  const awsBedrockModelPrefix = usePreferencesContext(
    (state) => state.awsBedrockModelPrefix
  );

  const handleModelChange = useCallback(
    (model: ModelMenuValue) => {
      if (model.provider === "AWS" && awsBedrockModelPrefix) {
        onChange?.({
          ...model,
          modelName: applyBedrockModelPrefix({
            modelName: model.modelName,
            prefix: awsBedrockModelPrefix,
          }),
        });
      } else {
        onChange?.(model);
      }
    },
    [onChange, awsBedrockModelPrefix]
  );
  const {
    customProviders,
    modelsByProvider,
    providerInfoMap,
    visibleProviders,
  } = useModelMenuData();

  // Providers whose models are searchable: visible in the menu and with
  // server dependencies installed, so search never surfaces a model that
  // cannot run.
  const searchableProviderKeys = useMemo(
    () =>
      new Set<string>(
        visibleProviders
          .filter((provider) => provider.dependenciesInstalled)
          .map((provider) => provider.key)
      ),
    [visibleProviders]
  );

  // Filter models when searching (built-in providers)
  const filteredModelsByProvider = useMemo(() => {
    if (!searchValue.trim()) {
      return new Map<string, string[]>();
    }

    const filtered = new Map<string, string[]>();
    for (const [providerKey, models] of modelsByProvider) {
      // Skip providers that are hidden from the menu
      if (!searchableProviderKeys.has(providerKey)) {
        continue;
      }
      const matchingModels = models.filter((model) =>
        contains(model, searchValue)
      );
      if (matchingModels.length > 0) {
        filtered.set(providerKey, matchingModels);
      }
    }
    return filtered;
  }, [searchValue, modelsByProvider, searchableProviderKeys, contains]);

  // Filter custom providers when searching
  const filteredCustomProviders = useMemo(() => {
    if (!searchValue.trim()) {
      return [];
    }

    return customProviders
      .map((provider) => ({
        ...provider,
        modelNames: provider.modelNames.filter((model) =>
          contains(model, searchValue)
        ),
      }))
      .filter((provider) => provider.modelNames.length > 0);
  }, [searchValue, customProviders, contains]);

  const isSearching = searchValue.trim().length > 0;

  const searchFilter = useCallback(
    (textValue: string, inputValue: string) => contains(textValue, inputValue),
    [contains]
  );

  const selectedProvider = value?.provider;
  const isValidSelectedProvider =
    selectedProvider && isModelProvider(selectedProvider);

  const triggerAriaLabel = value
    ? `Select model: ${value.modelName}`
    : "Select model";

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
      </Button>
      <MenuContainer placement={placement} shouldFlip={shouldFlip}>
        <Autocomplete filter={isSearching ? searchFilter : undefined}>
          <MenuHeader>
            <SearchField
              aria-label="Search models"
              variant="quiet"
              size="L"
              autoFocus
              value={searchValue}
              onChange={setSearchValue}
            >
              <SearchIcon />
              <Input placeholder="Search models..." />
            </SearchField>
          </MenuHeader>
          {isSearching ? (
            <ModelsByProviderMenu
              modelsByProvider={filteredModelsByProvider}
              providerInfoMap={providerInfoMap}
              customProviders={filteredCustomProviders}
              onChange={handleModelChange}
            />
          ) : (
            <ProviderMenu
              providers={visibleProviders}
              modelsByProvider={modelsByProvider}
              customProviders={customProviders}
              onChange={handleModelChange}
            />
          )}
        </Autocomplete>
        <MenuFooter>
          <LinkButton
            size="S"
            variant="quiet"
            leadingVisual={<Icon svg={<Icons.Settings />} />}
            to="/settings/providers"
          >
            Configure AI Providers
          </LinkButton>
        </MenuFooter>
      </MenuContainer>
    </MenuTrigger>
  );
}

type ModelsByProviderMenuProps = {
  modelsByProvider: Map<string, string[]>;
  providerInfoMap: Map<
    string,
    { name: string; dependenciesInstalled: boolean }
  >;
  customProviders: CustomProviderInfo[];
  onChange?: (model: ModelMenuValue) => void;
};

/**
 * Menu showing models grouped by provider sections.
 * Used when searching to display filtered results.
 */
export function ModelsByProviderMenu({
  modelsByProvider,
  providerInfoMap,
  customProviders,
  onChange,
}: ModelsByProviderMenuProps) {
  const awsBedrockModelPrefix = usePreferencesContext(
    (state) => state.awsBedrockModelPrefix
  );
  const displayModelName = (providerKey: string, modelName: string) =>
    providerKey === "AWS" && awsBedrockModelPrefix
      ? applyBedrockModelPrefix({
          modelName,
          prefix: awsBedrockModelPrefix,
        })
      : modelName;

  const handleModelSelect = (
    providerKey: string,
    modelName: string,
    customProvider?: CustomProviderRef
  ) => {
    if (isModelProvider(providerKey)) {
      onChange?.({
        provider: providerKey,
        modelName,
        customProvider,
      });
    }
  };

  return (
    <Menu
      css={menuWidthCSS}
      renderEmptyState={() => <ModelMenuEmptyState />}
      onAction={(key) => {
        const modelInfo = decodeMenuKey(String(key));
        if (!modelInfo) {
          return;
        }

        switch (modelInfo.type) {
          case "custom": {
            // Find the custom provider to get the SDK -> provider key mapping
            const customProvider = customProviders.find(
              (p) => p.id === modelInfo.customProviderId
            );
            if (customProvider) {
              const providerKey = getProviderKeyForGenerativeModelSDK(
                customProvider.sdk
              );
              handleModelSelect(providerKey, modelInfo.modelName, {
                id: customProvider.id,
                name: customProvider.name,
              });
            }
            break;
          }
          case "builtin":
            handleModelSelect(modelInfo.providerKey, modelInfo.modelName);
            break;
          default:
            assertUnreachable(modelInfo);
        }
      }}
    >
      {/* Custom providers */}
      {customProviders.map((customProvider) => {
        const providerKey = getProviderKeyForGenerativeModelSDK(
          customProvider.sdk
        );
        return (
          <MenuSection key={`custom-${customProvider.id}`}>
            <MenuSectionTitle title={customProvider.name} />
            {customProvider.modelNames.map((modelName) => {
              const itemKey = encodeCustomKey({
                customProviderId: customProvider.id,
                modelName,
              });
              return (
                <MenuItem
                  key={itemKey}
                  id={itemKey}
                  textValue={displayModelName(providerKey, modelName)}
                >
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <GenerativeProviderIcon
                      provider={providerKey}
                      height={16}
                    />
                    <Text>{displayModelName(providerKey, modelName)}</Text>
                  </Flex>
                </MenuItem>
              );
            })}
          </MenuSection>
        );
      })}
      {/* Built-in providers */}
      {Array.from(modelsByProvider.entries()).map(([providerKey, models]) => {
        const providerInfo = providerInfoMap.get(providerKey);
        const isValidProvider = isModelProvider(providerKey);
        return (
          <MenuSection key={providerKey}>
            <MenuSectionTitle title={providerInfo?.name ?? providerKey} />
            {models.map((modelName) => {
              const itemKey = encodeBuiltInKey({
                providerKey,
                modelName,
              });
              return (
                <MenuItem
                  key={itemKey}
                  id={itemKey}
                  textValue={displayModelName(providerKey, modelName)}
                >
                  <Flex direction="row" gap="size-100" alignItems="center">
                    {isValidProvider && (
                      <GenerativeProviderIcon
                        provider={providerKey}
                        height={16}
                      />
                    )}
                    <Text>{displayModelName(providerKey, modelName)}</Text>
                  </Flex>
                </MenuItem>
              );
            })}
          </MenuSection>
        );
      })}
    </Menu>
  );
}

type ProviderMenuProps = {
  providers: readonly ModelProviderInfo[];
  modelsByProvider: Map<string, string[]>;
  customProviders: CustomProviderInfo[];
  onChange?: (model: ModelMenuValue) => void;
};

/**
 * Menu showing a list of providers with submenus for their models.
 * Once a provider is provisioned only ready providers are listed; before
 * that, the flagship providers are shown as a fallback.
 * Used as the default view when not searching.
 */
export function ProviderMenu({
  providers,
  modelsByProvider,
  customProviders,
  onChange,
}: ProviderMenuProps) {
  return (
    <Menu css={menuWidthCSS} renderEmptyState={() => <ModelMenuEmptyState />}>
      <ProviderModelMenuItems
        providers={providers}
        modelsByProvider={modelsByProvider}
        customProviders={customProviders}
        onChange={onChange}
      />
    </Menu>
  );
}

/**
 * Empty state for the model picker. Inside the picker's Autocomplete an
 * active search automatically flips it to the search icon + "No results".
 */
function ModelMenuEmptyState() {
  return (
    <CompactEmptyState
      icon={<Icon svg={<Icons.Cube />} />}
      description="No models available"
    />
  );
}

export function ProviderModelMenuItems({
  providers,
  modelsByProvider,
  customProviders,
  onChange,
}: ProviderMenuProps) {
  return (
    <>
      {/* Custom providers */}
      {customProviders.map((customProvider) => {
        const providerKey = getProviderKeyForGenerativeModelSDK(
          customProvider.sdk
        );
        return (
          <SubmenuTrigger key={`custom-${customProvider.id}`}>
            <MenuItem
              id={`custom-${customProvider.id}`}
              textValue={customProvider.name}
            >
              <Flex direction="row" gap="size-100" alignItems="center">
                <GenerativeProviderIcon provider={providerKey} height={16} />
                <Text>{customProvider.name}</Text>
              </Flex>
            </MenuItem>
            <ProviderModelsSubmenu
              providerKey={providerKey}
              models={customProvider.modelNames}
              customProvider={{
                id: customProvider.id,
                name: customProvider.name,
              }}
              onChange={onChange}
            />
          </SubmenuTrigger>
        );
      })}
      {/* Built-in providers */}
      {providers.map((provider) => {
        const providerKey = provider.key;
        const isValidProvider = isModelProvider(providerKey);
        const models = modelsByProvider.get(providerKey) ?? [];

        return (
          <SubmenuTrigger key={provider.key}>
            <MenuItem
              id={provider.key}
              textValue={provider.name}
              isDisabled={!provider.dependenciesInstalled}
            >
              <Flex
                direction="row"
                gap="size-100"
                alignItems="center"
                justifyContent="space-between"
                width="100%"
              >
                <Flex direction="row" gap="size-100" alignItems="center">
                  {isValidProvider && (
                    <GenerativeProviderIcon
                      provider={providerKey}
                      height={16}
                    />
                  )}
                  <Text>{provider.name}</Text>
                </Flex>
                {provider.needsCredentials && (
                  <Text color="text-500" size="XS">
                    Needs credentials
                  </Text>
                )}
              </Flex>
            </MenuItem>
            <ProviderModelsSubmenu
              providerKey={providerKey}
              models={models}
              onChange={onChange}
            />
          </SubmenuTrigger>
        );
      })}
    </>
  );
}

type ProviderModelsSubmenuProps = {
  providerKey: GenerativeProviderKey;
  models: readonly string[];
  onChange?: (model: ModelMenuValue) => void;
  /**
   * If provided, this is a custom provider and the ref will be included in the selection
   */
  customProvider?: CustomProviderRef;
};

/**
 * Submenu for selecting a model from a provider.
 * Allows searching and selecting custom model names not in the list.
 * Works for both built-in providers and custom providers.
 */
function ProviderModelsSubmenu({
  providerKey,
  models,
  onChange,
  customProvider,
}: ProviderModelsSubmenuProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const [searchValue, setSearchValue] = useState("");
  const isValidProvider = isModelProvider(providerKey);
  const awsBedrockModelPrefix = usePreferencesContext(
    (state) => state.awsBedrockModelPrefix
  );
  const displayModelName = (name: string) =>
    providerKey === "AWS" && awsBedrockModelPrefix
      ? applyBedrockModelPrefix({
          modelName: name,
          prefix: awsBedrockModelPrefix,
        })
      : name;

  // Build the list of models, adding the search value as a custom option if needed
  const modelItems = useMemo(() => {
    const baseItems = models.map((name) => ({
      id: name,
      name,
      isCustom: false,
    }));

    const trimmedSearch = searchValue.trim();

    // If there's a search value and it doesn't exactly match an existing model, add it as custom
    const existsInItems = baseItems.some((item) => item.name === trimmedSearch);
    if (trimmedSearch && !existsInItems) {
      // Check if any existing models match the search (would be shown by filter)
      const hasMatches = baseItems.some((item) =>
        contains(item.name, trimmedSearch)
      );

      // Always add the custom option at the top when searching
      if (!hasMatches || trimmedSearch) {
        baseItems.unshift({
          id: `custom:${trimmedSearch}`,
          name: trimmedSearch,
          isCustom: true,
        });
      }
    }

    return baseItems;
  }, [models, searchValue, contains]);

  // Custom filter that always shows the custom option and matches against the display name
  const customFilter = (textValue: string, inputValue: string) => {
    // Always show the custom option (id starts with "custom:")
    if (textValue.startsWith("custom:")) {
      return true;
    }
    return contains(displayModelName(textValue), inputValue);
  };

  return (
    <MenuContainer placement="end top" shouldFlip>
      <Autocomplete filter={customFilter}>
        <MenuHeader>
          <SearchField
            aria-label="Search models"
            variant="quiet"
            autoFocus
            value={searchValue}
            onChange={setSearchValue}
          >
            <SearchIcon />
            <Input placeholder="Search or enter model name" />
          </SearchField>
        </MenuHeader>
        <Menu
          items={modelItems}
          onAction={(key) => {
            const keyStr = String(key);
            // Extract the actual model name (remove "custom:" prefix if present)
            const modelName = keyStr.startsWith("custom:")
              ? keyStr.slice(7)
              : keyStr;
            onChange?.({
              provider: providerKey,
              modelName,
              customProvider,
            });
          }}
        >
          {({ id, name, isCustom }) => (
            <MenuItem id={id} textValue={id}>
              <Flex direction="row" gap="size-100" alignItems="center">
                {isValidProvider && (
                  <GenerativeProviderIcon provider={providerKey} height={16} />
                )}
                <Text>{displayModelName(name)}</Text>
                {isCustom && (
                  <Text color="text-700" size="XS">
                    (custom)
                  </Text>
                )}
              </Flex>
            </MenuItem>
          )}
        </Menu>
      </Autocomplete>
    </MenuContainer>
  );
}
