import { useMemo } from "react";
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
  View,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type {
  GenerativeProviderKey,
  ModelMenuQuery,
} from "./__generated__/ModelMenuQuery.graphql";

export type ModelMenuProps = {
  onChange?: (model: {
    provider: GenerativeProviderKey;
    modelName: string;
  }) => void;
};

export function ModelMenu({ onChange }: ModelMenuProps) {
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

  return (
    <MenuTrigger>
      <Button size="S">
        {"Select a model"}
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
                  <MenuContainer placement="end top" shouldFlip>
                    <Autocomplete filter={contains}>
                      <MenuHeader>
                        <SearchField aria-label="Search models" autoFocus>
                          <SearchIcon />
                          <Input placeholder="Search models" />
                        </SearchField>
                      </MenuHeader>
                      <Menu
                        items={models.map((name) => ({ id: name, name }))}
                        renderEmptyState={() => (
                          <View padding="size-200">
                            <Text color="text-700">No models available</Text>
                          </View>
                        )}
                        onAction={(modelName) => {
                          onChange?.({
                            provider: providerKey,
                            modelName: String(modelName),
                          });
                        }}
                      >
                        {({ name }) => (
                          <MenuItem id={name} textValue={name}>
                            <Text>{name}</Text>
                          </MenuItem>
                        )}
                      </Menu>
                    </Autocomplete>
                  </MenuContainer>
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
