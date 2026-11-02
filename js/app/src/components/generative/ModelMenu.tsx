import { css } from "@emotion/react";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import {
  MenuSection,
  type PopoverProps,
  SubmenuTrigger,
} from "react-aria-components";

import {
  Alert,
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
  Tabs,
  TabList,
  Tab,
  useFilter,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchIcon } from "@phoenix/components/core/field";
import { CustomModelSubmenu } from "@phoenix/components/generative/CustomModelSubmenu";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import {
  ModelHighlight,
  ModelProviderIcon,
} from "@phoenix/components/generative/ModelPickerRow";
import {
  applyBedrockModelPrefix,
  getProviderKeyForGenerativeModelSDK,
} from "@phoenix/components/generative/modelProviderUtils";
import {
  buildModelCatalog,
  buildModelProviderOptions,
  getCustomModelOption,
  getProviderCredentialStateFromNeeds,
  type ModelCatalogInput,
  type ModelCatalogRow,
  searchModelsByProvider,
  toModelMenuValueFromRow,
} from "@phoenix/components/generative/modelSearch";
import {
  type CustomProviderInfo,
  type GenerativeProviderKey,
  type ModelCredentialSource,
  type ModelProviderInfo,
  useModelMenuData,
} from "@phoenix/components/generative/useModelMenuData";
import { usePreferencesContext } from "@phoenix/contexts";
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
  modelType?: ModelType;
  /**
   * Reference to custom provider if using one
   */
  customProvider?: CustomProviderRef;
};

/**
 * A standalone selectable entry listed above the providers — a model source
 * that is not a provider, so it has no submenu and selecting it reports its
 * id rather than a provider/model pair. The menu attaches no meaning to the
 * id; callers interpret it on selection.
 */
export type ModelMenuLeadingItem = {
  id: string;
  /** Shown in the menu row and on the trigger when selected */
  label: string;
  /** Icon shown beside the label, in place of a provider icon */
  icon?: ReactNode;
  /** Trailing annotation in the menu row, e.g. an availability status */
  trailing?: ReactNode;
  isDisabled?: boolean;
};

type LeadingItemsProps = {
  /**
   * Standalone entries listed above the providers. See
   * {@link ModelMenuLeadingItem}.
   */
  leadingItems?: readonly ModelMenuLeadingItem[];
  /**
   * Called with the item's id when a leading item is selected.
   */
  onLeadingItemSelect?: (id: string) => void;
};

/**
 * Delimiter used to separate parts of menu keys.
 * Using a Private Use Area (PUA) character unlikely to appear in provider IDs or model names.
 */
const KEY_DELIMITER = "\uE000";

function getModelType(
  value: ModelMenuValue | null | undefined,
  defaultModelType: ModelType = "LLM"
): ModelType {
  return value?.modelType ?? defaultModelType;
}

/**
 * The provider whose icon the trigger shows. A custom-provider selection
 * carries `provider` only to satisfy the value shape, so its icon comes from
 * the provider's SDK, as in the menu.
 */
function getSelectedProviderKey(
  value: ModelMenuValue | null | undefined,
  customProviders: readonly CustomProviderInfo[]
): string | undefined {
  if (value?.customProvider == null) return value?.provider;
  const customProvider = customProviders.find(
    (provider) => provider.id === value.customProvider?.id
  );
  return customProvider
    ? getProviderKeyForGenerativeModelSDK(customProvider.sdk)
    : undefined;
}

export type ModelMenuProps = Pick<PopoverProps, "placement" | "shouldFlip"> &
  LeadingItemsProps & {
    value?: ModelMenuValue | null;
    onChange?: (model: ModelMenuValue) => void;
    isDisabled?: boolean;
    /**
     * Id of the leading item the current selection refers to. When it names
     * an offered leading item, the trigger shows that item instead of
     * `value`.
     */
    selectedLeadingItemId?: string;
    /**
     * Visual variant of the trigger button.
     * - `"default"` — standard bordered button.
     * - `"quiet"` — borderless button.
     * @default "default"
     */
    variant?: "default" | "quiet";
    /**
     * Which credential store the surface's execution path can use when
     * judging provider readiness. Surfaces that send through the server
     * proxy should pass `"server"` so browser-local keys don't surface
     * providers the proxy cannot authenticate.
     * @default "any"
     */
    credentialSource?: ModelCredentialSource;
    /** Enable decision selection only on surfaces with a decision execution path. */
    supportsDecisionModels?: boolean;
    /** Restrict selection to one model type on specialized authoring forms. */
    fixedModelType?: ModelType;
    /**
     * The tab the menu opens on when no model is selected yet.
     * @default "LLM"
     */
    defaultModelType?: ModelType;
    /**
     * Shown above the Decision tab's providers when choosing a decision model
     * has a side effect the user should know about first (e.g. it clears the
     * loaded dataset).
     */
    decisionTabNotice?: string;
  };

export function ModelMenu({
  value,
  onChange,
  isDisabled = false,
  placement,
  shouldFlip,
  variant = "default",
  leadingItems,
  selectedLeadingItemId,
  onLeadingItemSelect,
  credentialSource,
  supportsDecisionModels = false,
  fixedModelType,
  defaultModelType,
  decisionTabNotice,
}: ModelMenuProps) {
  const [searchValue, setSearchValue] = useState("");
  const [selectedModelType, setModelType] = useState<ModelType>(
    getModelType(value, defaultModelType)
  );
  const modelType = fixedModelType ?? selectedModelType;
  const awsBedrockModelPrefix = usePreferencesContext(
    (state) => state.awsBedrockModelPrefix
  );

  const handleModelChange = useCallback(
    (model: ModelMenuValue) => {
      onChange?.({
        ...model,
        modelName:
          model.provider === "AWS" && awsBedrockModelPrefix
            ? applyBedrockModelPrefix({
                modelName: model.modelName,
                prefix: awsBedrockModelPrefix,
              })
            : model.modelName,
        modelType,
      });
    },
    [onChange, awsBedrockModelPrefix, modelType]
  );
  const { catalogModels, customProviders, modelsByProvider, visibleProviders } =
    useModelMenuData({
      credentialSource,
      modelType,
      includeDecisionModels: supportsDecisionModels,
    });

  const isSearching = searchValue.trim().length > 0;

  const selectedProvider = getSelectedProviderKey(value, customProviders);
  const isValidSelectedProvider =
    selectedProvider != null && isModelProvider(selectedProvider);

  const selectedLeadingItem =
    selectedLeadingItemId != null
      ? leadingItems?.find((item) => item.id === selectedLeadingItemId)
      : undefined;

  const triggerAriaLabel = selectedLeadingItem
    ? `Select model: ${selectedLeadingItem.label}`
    : value
      ? `Select model: ${value.modelName}`
      : "Select model";

  return (
    <MenuTrigger
      onOpenChange={(isOpen) => {
        if (isOpen) {
          setModelType(getModelType(value, defaultModelType));
          setSearchValue("");
        }
      }}
    >
      <Button
        size="S"
        variant={variant}
        isDisabled={isDisabled}
        aria-label={triggerAriaLabel}
      >
        {selectedLeadingItem ? (
          <Flex direction="row" gap="size-100" alignItems="center">
            {selectedLeadingItem.icon}
            <Text>{selectedLeadingItem.label}</Text>
          </Flex>
        ) : value ? (
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
          {supportsDecisionModels && !fixedModelType ? (
            <ModelTypeTabs
              modelType={modelType}
              notice={decisionTabNotice}
              onChange={setModelType}
            />
          ) : null}
          {isSearching ? (
            <ModelSearchResultsMenu
              key={modelType}
              query={searchValue}
              catalogModels={catalogModels}
              providers={visibleProviders}
              customProviders={customProviders}
              onChange={handleModelChange}
              leadingItems={leadingItems}
              onLeadingItemSelect={onLeadingItemSelect}
            />
          ) : (
            <ProviderMenu
              key={modelType}
              providers={visibleProviders}
              modelsByProvider={modelsByProvider}
              customProviders={customProviders}
              onChange={handleModelChange}
              leadingItems={leadingItems}
              onLeadingItemSelect={onLeadingItemSelect}
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

/**
 * The LLM / Decision switch under the search field, with an optional notice
 * above the Decision list. Rendered inside the picker's Autocomplete so the
 * search field stays first in DOM and keyboard order.
 */
function ModelTypeTabs({
  modelType,
  notice,
  onChange,
}: {
  modelType: ModelType;
  notice?: string;
  onChange: (modelType: ModelType) => void;
}) {
  return (
    <>
      <Tabs
        selectedKey={modelType}
        onSelectionChange={(key) =>
          onChange(key === "DECISION" ? "DECISION" : "LLM")
        }
        // Tabs default to filling their parent (height: 100%, flex-grow)
        // because they normally own the panel below them. Here the menu
        // owns the content, so the tab bar must size to its tabs or it
        // stretches into the menu's min-height and leaves a gap. The
        // component sets its growth under an orientation attribute
        // selector, so the override has to match that specificity.
        css={css`
          &[data-orientation] {
            flex: none;
            height: auto;
          }
        `}
      >
        <TabList aria-label="Model type">
          <Tab id="LLM">LLM</Tab>
          <Tab id="DECISION">Decision</Tab>
        </TabList>
      </Tabs>
      {modelType === "DECISION" && notice ? (
        <Alert variant="warning" banner>
          {notice}
        </Alert>
      ) : null}
    </>
  );
}

/**
 * The leading items as directly selectable menu rows, rendered at the top of
 * both the browse and search views. Their keys use the same reserved
 * delimiter as model keys so they can never collide with provider ids, and
 * selection is reported through each item's own `onAction` rather than the
 * menu-level key decoding.
 */
function LeadingItemMenuItems({
  leadingItems,
  onLeadingItemSelect,
}: LeadingItemsProps) {
  return (
    <>
      {leadingItems?.map((item) => (
        <MenuItem
          key={item.id}
          id={`leading${KEY_DELIMITER}${item.id}`}
          textValue={item.label}
          isDisabled={item.isDisabled}
          onAction={() => onLeadingItemSelect?.(item.id)}
        >
          <Flex
            direction="row"
            gap="size-100"
            alignItems="center"
            justifyContent="space-between"
            width="100%"
          >
            <Flex direction="row" gap="size-100" alignItems="center">
              {item.icon}
              <Text>{item.label}</Text>
            </Flex>
            {item.trailing}
          </Flex>
        </MenuItem>
      ))}
    </>
  );
}

/** The id of the "Use `x` as a custom model" row. */
const CUSTOM_MODEL_ITEM_ID = `custom-model${KEY_DELIMITER}`;

/** A search result's menu item id; the delimiter keeps it off leading ids. */
function getModelItemId(row: ModelCatalogRow): string {
  return `model${KEY_DELIMITER}${row.key}`;
}

type ModelSearchResultsMenuProps = LeadingItemsProps & {
  /** The search text */
  query: string;
  /** Built-in models of the selected model type */
  catalogModels: ModelCatalogInput["models"];
  /** Built-in providers listed for the selected model type */
  providers: readonly ModelProviderInfo[];
  /** Custom providers listed for the selected model type */
  customProviders: readonly CustomProviderInfo[];
  onChange?: (model: ModelMenuValue) => void;
};

/**
 * The search view: matching models under their provider (see
 * `searchModelsByProvider`), then a "Use `x` as a custom model" row whose
 * submenu sends the typed name to one of the listed providers, the one
 * guessed from the name first. Only the providers the menu lists for the
 * selected model type are searched and offered, so the Decision tab only
 * offers providers that serve decision models.
 */
export function ModelSearchResultsMenu({
  query,
  catalogModels,
  providers: visibleProviders,
  customProviders,
  onChange,
  leadingItems,
  onLeadingItemSelect,
}: ModelSearchResultsMenuProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const awsBedrockModelPrefix = usePreferencesContext(
    (state) => state.awsBedrockModelPrefix
  );
  const providers = buildModelProviderOptions({
    modelProviders: visibleProviders,
    customProviders,
    getCredentialState: getProviderCredentialStateFromNeeds,
  });
  const rows = buildModelCatalog({
    models: catalogModels,
    providers,
    customProviders,
  });
  const sections = searchModelsByProvider({ rows, providers, query });
  const customModelOption = getCustomModelOption({ query, providers });
  const matchingLeadingItems = leadingItems?.filter((item) =>
    contains(item.label, query.trim())
  );
  const rowsByItemId = new Map(
    sections.flatMap((section) =>
      section.rows.map((row) => [getModelItemId(row), row])
    )
  );
  const displayModelName = (row: ModelCatalogRow) =>
    row.provider === "AWS" && awsBedrockModelPrefix
      ? applyBedrockModelPrefix({
          modelName: row.modelName,
          prefix: awsBedrockModelPrefix,
        })
      : row.modelName;

  return (
    <Menu
      css={menuWidthCSS}
      aria-label="Models"
      renderEmptyState={() => <ModelMenuEmptyState />}
      onAction={(key) => {
        const row = rowsByItemId.get(String(key));
        if (row) {
          onChange?.(toModelMenuValueFromRow(row));
        }
      }}
    >
      <LeadingItemMenuItems
        leadingItems={matchingLeadingItems}
        onLeadingItemSelect={onLeadingItemSelect}
      />
      {sections.map(({ provider, rows: providerRows }) => (
        <MenuSection key={provider.key} id={provider.key}>
          <MenuSectionTitle title={provider.name} />
          {providerRows.map((row) => {
            const itemId = getModelItemId(row);
            const name = displayModelName(row);
            return (
              <MenuItem key={itemId} id={itemId} textValue={name}>
                <Flex direction="row" gap="size-100" alignItems="center">
                  <ModelProviderIcon provider={row.provider} />
                  <Text>
                    <ModelHighlight text={name} query={query} />
                  </Text>
                </Flex>
              </MenuItem>
            );
          })}
        </MenuSection>
      ))}
      {customModelOption ? (
        <MenuSection id="custom-model">
          <CustomModelSubmenu
            id={CUSTOM_MODEL_ITEM_ID}
            option={customModelOption}
            onPick={({ modelName, provider }) =>
              onChange?.(
                toModelMenuValueFromRow({
                  provider: provider.provider,
                  customProvider: provider.customProvider,
                  modelName,
                })
              )
            }
          />
        </MenuSection>
      ) : null}
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
  leadingItems,
  onLeadingItemSelect,
}: ProviderMenuProps & LeadingItemsProps) {
  return (
    <Menu css={menuWidthCSS} renderEmptyState={() => <ModelMenuEmptyState />}>
      <LeadingItemMenuItems
        leadingItems={leadingItems}
        onLeadingItemSelect={onLeadingItemSelect}
      />
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
