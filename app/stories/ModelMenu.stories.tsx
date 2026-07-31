import type { Meta, StoryObj } from "@storybook/react";
import { useMemo, useState } from "react";
import { Autocomplete, useFilter } from "react-aria-components";

import {
  Button,
  Input,
  MenuContainer,
  MenuHeader,
  MenuTrigger,
  SearchField,
} from "@phoenix/components";
import { SearchIcon } from "@phoenix/components/core/field";
import {
  ModelsByProviderMenu,
  ProviderMenu,
} from "@phoenix/components/generative/ModelMenu";
import type {
  CustomProviderInfo,
  ModelProviderInfo,
} from "@phoenix/components/generative/useModelMenuData";

/**
 * Stories for the model picker menu states: the flagship-provider fallback
 * shown before any provider is provisioned (with "Needs credentials" hints),
 * the provisioned view, disabled providers with missing dependencies, and
 * the empty state. Type in the search field to see the search states,
 * including "No results".
 */
const meta: Meta<typeof ProviderMenu> = {
  title: "Generative/ModelMenu",
  component: ProviderMenu,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const MODELS_BY_PROVIDER = new Map<string, string[]>([
  ["OPENAI", ["gpt-5.6-luna", "gpt-5.6-sol", "gpt-5.4-mini"]],
  ["ANTHROPIC", ["claude-fable-5", "claude-sonnet-4-6", "claude-haiku-4-5"]],
  ["AZURE_OPENAI", ["gpt-5.6-luna", "gpt-5.4-mini"]],
  [
    "AWS",
    [
      "anthropic.claude-3-haiku-20240307-v1:0",
      "meta.llama3-1-70b-instruct-v1:0",
    ],
  ],
  ["GOOGLE", ["gemini-3.1-pro-preview", "gemini-3.5-flash"]],
]);

const provider = ({
  key,
  name,
  dependenciesInstalled = true,
  credentialsSet = false,
  needsCredentials = true,
}: Partial<ModelProviderInfo> &
  Pick<ModelProviderInfo, "key" | "name">): ModelProviderInfo => ({
  key,
  name,
  dependenciesInstalled,
  credentialsSet,
  needsCredentials,
});

/**
 * The flagship fallback: no provider has been provisioned, so every provider
 * still needs credentials.
 */
const FALLBACK_PROVIDERS: ModelProviderInfo[] = [
  provider({ key: "OPENAI", name: "OpenAI" }),
  provider({ key: "ANTHROPIC", name: "Anthropic" }),
  provider({ key: "AZURE_OPENAI", name: "Azure OpenAI" }),
  provider({ key: "AWS", name: "AWS Bedrock" }),
  provider({ key: "GOOGLE", name: "Gemini" }),
];

/**
 * OpenAI is credentialed; the default-credential-chain providers (AWS
 * Bedrock, Azure OpenAI) are listed as ready but still hint that no explicit
 * credentials are set.
 */
const PROVISIONED_PROVIDERS: ModelProviderInfo[] = [
  provider({
    key: "OPENAI",
    name: "OpenAI",
    credentialsSet: true,
    needsCredentials: false,
  }),
  provider({ key: "AZURE_OPENAI", name: "Azure OpenAI" }),
  provider({ key: "AWS", name: "AWS Bedrock" }),
];

const CUSTOM_PROVIDERS: CustomProviderInfo[] = [
  {
    id: "custom-1",
    name: "In-house vLLM",
    sdk: "OPENAI",
    modelNames: ["qwen-3-32b", "phoenix-ft-1"],
  },
];

/**
 * The presentational half of the real ModelMenu: trigger, search header, and
 * the provider/search menus, with the provider data injected instead of
 * fetched over Relay.
 */
function ModelMenuDemo({
  providers,
  customProviders = [],
}: {
  providers: ModelProviderInfo[];
  customProviders?: CustomProviderInfo[];
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  const [searchValue, setSearchValue] = useState("");
  const isSearching = searchValue.trim().length > 0;

  const providerInfoMap = useMemo(
    () =>
      new Map(
        providers.map(({ key, name, dependenciesInstalled }) => [
          key as string,
          { name, dependenciesInstalled },
        ])
      ),
    [providers]
  );

  const filteredModelsByProvider = useMemo(() => {
    const filtered = new Map<string, string[]>();
    if (!isSearching) {
      return filtered;
    }
    for (const [providerKey, models] of MODELS_BY_PROVIDER) {
      if (!providerInfoMap.get(providerKey)?.dependenciesInstalled) {
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
  }, [isSearching, searchValue, providerInfoMap, contains]);

  const filteredCustomProviders = useMemo(() => {
    if (!isSearching) {
      return [];
    }
    return customProviders
      .map((customProvider) => ({
        ...customProvider,
        modelNames: customProvider.modelNames.filter((model) =>
          contains(model, searchValue)
        ),
      }))
      .filter((customProvider) => customProvider.modelNames.length > 0);
  }, [isSearching, searchValue, customProviders, contains]);

  return (
    <MenuTrigger defaultOpen>
      <Button size="S">Select a model</Button>
      <MenuContainer>
        <Autocomplete>
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
            />
          ) : (
            <ProviderMenu
              providers={providers}
              modelsByProvider={MODELS_BY_PROVIDER}
              customProviders={customProviders}
            />
          )}
        </Autocomplete>
      </MenuContainer>
    </MenuTrigger>
  );
}

type Story = StoryObj<typeof ModelMenuDemo>;

/**
 * Nothing provisioned: the flagship providers are listed as a fallback,
 * each hinting that credentials are still needed.
 */
export const NoProvidersProvisioned: Story = {
  render: () => <ModelMenuDemo providers={FALLBACK_PROVIDERS} />,
};

/**
 * OpenAI is provisioned so only ready providers are listed. The
 * default-credential-chain providers (AWS Bedrock, Azure OpenAI) stay
 * visible with a "Needs credentials" hint since ambient credentials cannot
 * be detected.
 */
export const ProviderProvisioned: Story = {
  render: () => <ModelMenuDemo providers={PROVISIONED_PROVIDERS} />,
};

/**
 * A provider whose server dependencies are not installed renders disabled.
 */
export const MissingDependencies: Story = {
  render: () => (
    <ModelMenuDemo
      providers={[
        provider({
          key: "OPENAI",
          name: "OpenAI",
          credentialsSet: true,
          needsCredentials: false,
        }),
        provider({
          key: "GOOGLE",
          name: "Gemini",
          dependenciesInstalled: false,
        }),
      ]}
    />
  ),
};

/**
 * Custom providers are listed above the built-in providers.
 */
export const WithCustomProvider: Story = {
  render: () => (
    <ModelMenuDemo
      providers={PROVISIONED_PROVIDERS}
      customProviders={CUSTOM_PROVIDERS}
    />
  ),
};

/**
 * No providers at all: the menu renders its empty state. Typing a query
 * flips it to the search icon + "No results".
 */
export const Empty: Story = {
  render: () => <ModelMenuDemo providers={[]} />,
};
