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
  GenerativeProviderKey,
  ModelMenuQuery,
} from "./__generated__/ModelMenuQuery.graphql";

const menuWidthCSS = css`
  min-width: 350px;
`;

export type ModelMenuValue = {
  provider: GenerativeProviderKey;
  modelName: string;
};

export type ModelMenuProps = {
  value?: ModelMenuValue | null;
  onChange?: (model: ModelMenuValue) => void;
};

export function ModelMenu({ value, onChange }: ModelMenuProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const [searchValue, setSearchValue] = useState("");
  const data = useLazyLoadQuery<ModelMenuQuery>(
    graphql`
      query ModelMenuQuery {
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

  // Filter models when searching
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
            onChange={onChange}
          />
        ) : (
          <ProviderMenu
            providers={data.modelProviders}
            modelsByProvider={modelsByProvider}
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
  onChange?: (model: ModelMenuValue) => void;
};

/**
 * Menu showing models grouped by provider sections.
 * Used when searching to display filtered results.
 */
function ModelsByProviderMenu({
  modelsByProvider,
  providerInfoMap,
  onChange,
}: ModelsByProviderMenuProps) {
  const handleModelSelect = (providerKey: string, modelName: string) => {
    if (isModelProvider(providerKey)) {
      onChange?.({
        provider: providerKey,
        modelName,
      });
    }
  };

  return (
    <Menu
      css={menuWidthCSS}
      autoFocus={false}
      onAction={(key) => {
        const keyStr = String(key);
        // Key format is "providerKey:modelName"
        const separatorIndex = keyStr.indexOf(":");
        if (separatorIndex > 0) {
          const providerKey = keyStr.slice(0, separatorIndex);
          const modelName = keyStr.slice(separatorIndex + 1);
          handleModelSelect(providerKey, modelName);
        }
      }}
    >
      {modelsByProvider.size > 0 ? (
        Array.from(modelsByProvider.entries()).map(([providerKey, models]) => {
          const providerInfo = providerInfoMap.get(providerKey);
          const isValidProvider = isModelProvider(providerKey);
          return (
            <MenuSection key={providerKey}>
              <MenuSectionTitle title={providerInfo?.name ?? providerKey} />
              {models.map((modelName) => (
                <MenuItem
                  key={`${providerKey}:${modelName}`}
                  id={`${providerKey}:${modelName}`}
                  textValue={modelName}
                >
                  <Flex direction="row" gap="size-100" alignItems="center">
                    {isValidProvider && (
                      <GenerativeProviderIcon
                        provider={providerKey}
                        height={16}
                      />
                    )}
                    <Text>{modelName}</Text>
                  </Flex>
                </MenuItem>
              ))}
            </MenuSection>
          );
        })
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
  onChange?: (model: ModelMenuValue) => void;
};

/**
 * Menu showing a list of providers with submenus for their models.
 * Used as the default view when not searching.
 */
function ProviderMenu({
  providers,
  modelsByProvider,
  onChange,
}: ProviderMenuProps) {
  return (
    <Menu css={menuWidthCSS} autoFocus={false}>
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
  models: string[];
  onChange?: (model: ModelMenuValue) => void;
};

/**
 * Submenu for selecting a model from a provider.
 * Allows searching and selecting custom model names not in the list.
 */
function ProviderModelsSubmenu({
  providerKey,
  models,
  onChange,
}: ProviderModelsSubmenuProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const [searchValue, setSearchValue] = useState("");
  const isValidProvider = isModelProvider(providerKey);

  // Build the list of models, adding the search value as a custom option if needed
  const modelItems = useMemo(() => {
    const baseItems = models.map((name) => ({
      id: name,
      name,
      isCustom: false,
    }));
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
        });
      }
    }

    return baseItems;
  }, [models, searchValue, contains]);

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
            });
          }}
        >
          {({ id, name, isCustom }) => (
            <MenuItem id={id} textValue={id}>
              <Flex direction="row" gap="size-100" alignItems="center">
                {isValidProvider && (
                  <GenerativeProviderIcon provider={providerKey} height={16} />
                )}
                <Text>{name}</Text>
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
