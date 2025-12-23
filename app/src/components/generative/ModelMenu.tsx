import { useMemo, useState } from "react";
import { SubmenuTrigger } from "react-aria-components";
import { graphql, useLazyLoadQuery } from "react-relay";

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
        <Autocomplete filter={contains}>
          <Menu>
            {data.modelProviders.map((provider) => {
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
                        <GenerativeProviderIcon
                          provider={providerKey}
                          height={16}
                        />
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
        </Autocomplete>
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
