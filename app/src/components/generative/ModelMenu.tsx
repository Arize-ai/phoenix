import { useMemo, useState } from "react";
import { MenuSection, SubmenuTrigger } from "react-aria-components";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

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
  SearchIcon,
  SelectChevronUpDownIcon,
  Text,
  useFilter,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type {
  GenerativeModelSDK,
  GenerativeProviderKey,
  ModelMenuQuery,
} from "./__generated__/ModelMenuQuery.graphql";

const menuWidthCSS = css`
  min-width: 350px;
`;

export type ModelMenuValue = {
  provider: GenerativeProviderKey;
  modelName: string;
  /**
   * The custom provider ID if using a custom provider
   */
  customProviderId?: string;
};

type CustomProviderInfo = {
  id: string;
  name: string;
  sdk: GenerativeModelSDK;
  modelNames: readonly string[];
};

/**
 * Maps GenerativeModelSDK to GenerativeProviderKey for icon display
 */
const SDK_TO_PROVIDER_KEY: Record<GenerativeModelSDK, GenerativeProviderKey> = {
  OPENAI: "OPENAI",
  AZURE_OPENAI: "AZURE_OPENAI",
  ANTHROPIC: "ANTHROPIC",
  AWS_BEDROCK: "AWS",
  GOOGLE_GENAI: "GOOGLE",
};

/**
 * Delimiter used to separate parts of menu keys.
 * Using a Private Use Area (PUA) character unlikely to appear in provider IDs or model names.
 */
const KEY_DELIMITER = "\uE000";

type MenuKeyBuiltIn = {
  type: "builtin";
  providerKey: string;
  modelName: string;
};

type MenuKeyCustom = {
  type: "custom";
  customProviderId: string;
  modelName: string;
};

type MenuKey = MenuKeyBuiltIn | MenuKeyCustom;

/**
 * Encodes a menu key for a built-in provider model
 */
function encodeBuiltInKey(providerKey: string, modelName: string): string {
  return `builtin${KEY_DELIMITER}${providerKey}${KEY_DELIMITER}${modelName}`;
}

/**
 * Encodes a menu key for a custom provider model
 */
function encodeCustomKey(customProviderId: string, modelName: string): string {
  return `custom${KEY_DELIMITER}${customProviderId}${KEY_DELIMITER}${modelName}`;
}

/**
 * Decodes a menu key string into its components
 */
function decodeMenuKey(key: string): MenuKey | null {
  const parts = key.split(KEY_DELIMITER);
  if (parts.length !== 3) {
    return null;
  }

  const [type, id, modelName] = parts;
  if (type === "custom") {
    return { type: "custom", customProviderId: id, modelName };
  } else if (type === "builtin") {
    return { type: "builtin", providerKey: id, modelName };
  }
  return null;
}

export type ModelMenuProps = {
  value?: ModelMenuValue | null;
  onChange?: (model: ModelMenuValue) => void;
  /**
   * Map of provider key to default model name (from saved preferences)
   */
  defaultModelByProvider?: Partial<Record<GenerativeProviderKey, string>>;
};

export function ModelMenu({
  value,
  onChange,
  defaultModelByProvider,
}: ModelMenuProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const [searchValue, setSearchValue] = useState("");
  const data = useLazyLoadQuery<ModelMenuQuery>(
    graphql`
      query ModelMenuQuery {
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
        modelProviders {
          key
          name
          dependenciesInstalled
        }
        playgroundModels {
          name
          providerKey
        }
      }
    `,
    {}
  );

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const grouped = new Map<string, string[]>();
    for (const model of data.playgroundModels) {
      const existing = grouped.get(model.providerKey) ?? [];
      existing.push(model.name);
      grouped.set(model.providerKey, existing);
    }
    return grouped;
  }, [data.playgroundModels]);

  // Create a map of provider key to provider info for quick lookup
  const providerInfoMap = useMemo(() => {
    const map = new Map<
      string,
      { name: string; dependenciesInstalled: boolean }
    >();
    for (const provider of data.modelProviders) {
      map.set(provider.key, {
        name: provider.name,
        dependenciesInstalled: provider.dependenciesInstalled,
      });
    }
    return map;
  }, [data.modelProviders]);

  // Extract custom providers from the connection
  const customProviders = useMemo((): CustomProviderInfo[] => {
    return data.generativeModelCustomProviders.edges.map((edge) => ({
      id: edge.node.id,
      name: edge.node.name,
      sdk: edge.node.sdk,
      modelNames: edge.node.modelNames,
    }));
  }, [data.generativeModelCustomProviders]);

  // Filter models when searching (built-in providers)
  const filteredModelsByProvider = useMemo(() => {
    if (!searchValue.trim()) {
      return new Map<string, string[]>();
    }

    const filtered = new Map<string, string[]>();
    for (const [providerKey, models] of modelsByProvider) {
      const providerInfo = providerInfoMap.get(providerKey);
      // Skip providers without dependencies installed
      if (!providerInfo?.dependenciesInstalled) {
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
  }, [searchValue, modelsByProvider, providerInfoMap, contains]);

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

  const selectedProvider = value?.provider;
  const isValidSelectedProvider =
    selectedProvider && isModelProvider(selectedProvider);

  return (
    <MenuTrigger>
      <Button size="S">
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
        <SelectChevronUpDownIcon />
      </Button>
      <MenuContainer>
        <MenuHeader>
          <SearchField
            aria-label="Search models"
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
            defaultModelByProvider={defaultModelByProvider}
            onChange={onChange}
          />
        ) : (
          <ProviderMenu
            providers={data.modelProviders}
            modelsByProvider={modelsByProvider}
            customProviders={customProviders}
            defaultModelByProvider={defaultModelByProvider}
            onChange={onChange}
          />
        )}
        <MenuFooter>
          <LinkButton
            size="S"
            variant="quiet"
            leadingVisual={<Icon svg={<Icons.SettingsOutline />} />}
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
  defaultModelByProvider?: Partial<Record<GenerativeProviderKey, string>>;
  onChange?: (model: ModelMenuValue) => void;
};

/**
 * Menu showing models grouped by provider sections.
 * Used when searching to display filtered results.
 */
function ModelsByProviderMenu({
  modelsByProvider,
  providerInfoMap,
  customProviders,
  defaultModelByProvider,
  onChange,
}: ModelsByProviderMenuProps) {
  const handleModelSelect = (
    providerKey: string,
    modelName: string,
    customProviderId?: string
  ) => {
    if (isModelProvider(providerKey)) {
      onChange?.({
        provider: providerKey,
        modelName,
        customProviderId,
      });
    }
  };

  const hasBuiltInResults = modelsByProvider.size > 0;
  const hasCustomResults = customProviders.length > 0;
  const hasResults = hasBuiltInResults || hasCustomResults;

  return (
    <Menu
      css={menuWidthCSS}
      autoFocus={false}
      onAction={(key) => {
        const parsed = decodeMenuKey(String(key));
        if (!parsed) {
          return;
        }

        if (parsed.type === "custom") {
          // Find the custom provider to get the SDK -> provider key mapping
          const customProvider = customProviders.find(
            (p) => p.id === parsed.customProviderId
          );
          if (customProvider) {
            const providerKey = SDK_TO_PROVIDER_KEY[customProvider.sdk];
            handleModelSelect(
              providerKey,
              parsed.modelName,
              parsed.customProviderId
            );
          }
        } else {
          handleModelSelect(parsed.providerKey, parsed.modelName);
        }
      }}
    >
      {hasResults ? (
        <>
          {/* Custom providers */}
          {customProviders.map((customProvider) => {
            const providerKey = SDK_TO_PROVIDER_KEY[customProvider.sdk];
            return (
              <MenuSection key={`custom-${customProvider.id}`}>
                <MenuSectionTitle title={customProvider.name} />
                {customProvider.modelNames.map((modelName) => {
                  const itemKey = encodeCustomKey(customProvider.id, modelName);
                  return (
                    <MenuItem key={itemKey} id={itemKey} textValue={modelName}>
                      <Flex direction="row" gap="size-100" alignItems="center">
                        <GenerativeProviderIcon
                          provider={providerKey}
                          height={16}
                        />
                        <Text>{modelName}</Text>
                      </Flex>
                    </MenuItem>
                  );
                })}
              </MenuSection>
            );
          })}
          {/* Built-in providers */}
          {Array.from(modelsByProvider.entries()).map(
            ([providerKey, models]) => {
              const providerInfo = providerInfoMap.get(providerKey);
              const isValidProvider = isModelProvider(providerKey);
              const defaultModelName = isValidProvider
                ? defaultModelByProvider?.[providerKey]
                : undefined;
              return (
                <MenuSection key={providerKey}>
                  <MenuSectionTitle title={providerInfo?.name ?? providerKey} />
                  {models.map((modelName) => {
                    const itemKey = encodeBuiltInKey(providerKey, modelName);
                    const isDefault = modelName === defaultModelName;
                    return (
                      <MenuItem
                        key={itemKey}
                        id={itemKey}
                        textValue={modelName}
                      >
                        <Flex
                          direction="row"
                          gap="size-100"
                          alignItems="center"
                        >
                          {isValidProvider && (
                            <GenerativeProviderIcon
                              provider={providerKey}
                              height={16}
                            />
                          )}
                          <Text>{modelName}</Text>
                          {isDefault && (
                            <Text color="text-700" size="XS">
                              (default)
                            </Text>
                          )}
                        </Flex>
                      </MenuItem>
                    );
                  })}
                </MenuSection>
              );
            }
          )}
        </>
      ) : (
        <MenuItem id="no-results" textValue="No results" isDisabled>
          <Text color="text-700">No models found</Text>
        </MenuItem>
      )}
    </Menu>
  );
}

type ProviderMenuProps = {
  providers: readonly {
    readonly key: GenerativeProviderKey;
    readonly name: string;
    readonly dependenciesInstalled: boolean;
  }[];
  modelsByProvider: Map<string, string[]>;
  customProviders: CustomProviderInfo[];
  defaultModelByProvider?: Partial<Record<GenerativeProviderKey, string>>;
  onChange?: (model: ModelMenuValue) => void;
};

/**
 * Menu showing a list of providers with submenus for their models.
 * Used as the default view when not searching.
 */
function ProviderMenu({
  providers,
  modelsByProvider,
  customProviders,
  defaultModelByProvider,
  onChange,
}: ProviderMenuProps) {
  return (
    <Menu css={menuWidthCSS} autoFocus={false}>
      {/* Custom providers */}
      {customProviders.map((customProvider) => {
        const providerKey = SDK_TO_PROVIDER_KEY[customProvider.sdk];
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
              customProviderId={customProvider.id}
              defaultModelName={defaultModelByProvider?.[providerKey]}
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
              <Flex direction="row" gap="size-100" alignItems="center">
                {isValidProvider && (
                  <GenerativeProviderIcon provider={providerKey} height={16} />
                )}
                <Text>{provider.name}</Text>
              </Flex>
            </MenuItem>
            <ProviderModelsSubmenu
              providerKey={providerKey}
              models={models}
              defaultModelName={defaultModelByProvider?.[providerKey]}
              onChange={onChange}
            />
          </SubmenuTrigger>
        );
      })}
    </Menu>
  );
}

type ProviderModelsSubmenuProps = {
  providerKey: GenerativeProviderKey;
  models: readonly string[];
  onChange?: (model: ModelMenuValue) => void;
  /**
   * If provided, this is a custom provider and the ID will be included in the selection
   */
  customProviderId?: string;
  /**
   * The default model name for this provider (from saved preferences)
   */
  defaultModelName?: string;
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
  customProviderId,
  defaultModelName,
}: ProviderModelsSubmenuProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const [searchValue, setSearchValue] = useState("");
  const isValidProvider = isModelProvider(providerKey);

  // Build the list of models, adding the search value as a custom option if needed
  // and putting the default model at the top
  const modelItems = useMemo(() => {
    // Create items with isDefault flag
    const baseItems = models.map((name) => ({
      id: name,
      name,
      isCustom: false,
      isDefault: name === defaultModelName,
    }));

    // If default model is not in the list, add it at the top
    if (defaultModelName && !models.includes(defaultModelName)) {
      baseItems.unshift({
        id: defaultModelName,
        name: defaultModelName,
        isCustom: false,
        isDefault: true,
      });
    } else if (defaultModelName) {
      // Sort to put default model at the top
      baseItems.sort((a, b) => {
        if (a.isDefault) return -1;
        if (b.isDefault) return 1;
        return 0;
      });
    }

    const trimmedSearch = searchValue.trim();

    // If there's a search value and it doesn't exactly match an existing model, add it as custom
    if (trimmedSearch && !models.some((m) => m === trimmedSearch)) {
      // Check if any existing models match the search (would be shown by filter)
      const hasMatches = models.some((m) => contains(m, trimmedSearch));

      // Always add the custom option at the top when searching
      if (!hasMatches || trimmedSearch) {
        baseItems.unshift({
          id: `custom:${trimmedSearch}`,
          name: trimmedSearch,
          isCustom: true,
          isDefault: false,
        });
      }
    }

    return baseItems;
  }, [models, searchValue, contains, defaultModelName]);

  // Custom filter that always shows the custom option
  const customFilter = (textValue: string, inputValue: string) => {
    // Always show the custom option (it starts with "custom:")
    if (textValue.startsWith("custom:")) {
      return true;
    }
    return contains(textValue, inputValue);
  };

  return (
    <MenuContainer placement="end top" shouldFlip>
      <Autocomplete filter={customFilter}>
        <MenuHeader>
          <SearchField
            aria-label="Search models"
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
              customProviderId,
            });
          }}
        >
          {({ id, name, isCustom, isDefault }) => (
            <MenuItem id={id} textValue={id}>
              <Flex direction="row" gap="size-100" alignItems="center">
                {isValidProvider && (
                  <GenerativeProviderIcon provider={providerKey} height={16} />
                )}
                <Text>{name}</Text>
                {isDefault && (
                  <Text color="text-700" size="XS">
                    (default)
                  </Text>
                )}
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
