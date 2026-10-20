import { css } from "@emotion/react";
import type { KeyboardEvent, RefObject } from "react";
import { useMemo, useRef, useState } from "react";
import type { Key } from "react-aria-components";
import { MenuSection } from "react-aria-components";

import {
  Autocomplete,
  Button,
  Icon,
  Icons,
  Input,
  Menu,
  MenuContainer,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
  SearchField,
  Text,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { applyBedrockModelPrefix } from "@phoenix/components/generative/modelProviderUtils";
import { useModelMenuData } from "@phoenix/components/generative/useModelMenuData";
import { usePreferencesContext } from "@phoenix/contexts";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { getCuratedBuiltInModels } from "./agentCuratedModels";
import {
  getAgentModelKey,
  getAgentModelKeyForValue,
  getRecentAgentModels,
} from "./agentModelConfig";
import {
  AgentModelCredentialHint,
  AgentModelProviderIcon,
  AgentModelRow,
  AgentModelRowLayout,
} from "./AgentModelPickerRow";
import {
  type AgentModelCatalogRow,
  type AgentModelFreeTextTarget,
  type AgentModelProviderOption,
  type AgentModelScope,
  buildAgentModelCatalog,
  buildAgentModelProviderOptions,
  getAgentModelFreeTextTarget,
  getCredentialStateOrder,
  rankAgentModels,
  resolveAgentModelRow,
  toAgentModelMenuValue,
} from "./agentModelSearch";

/** The popover's width when the boundary is wider (or not given). */
const DEFAULT_POPOVER_MAX_WIDTH = 380;

/** Joins a section id and a model key into a menu item id. */
const ITEM_ID_SEPARATOR = "";

/** The provider list's "no scope" entry. */
const ALL_PROVIDERS_KEY = "all";

type PickerModelItem = {
  kind: "model";
  id: string;
  row: AgentModelCatalogRow;
  /** The value to emit, before the Bedrock prefix */
  value: ModelMenuValue;
};

type PickerFreeTextItem = {
  kind: "free-text";
  id: string;
  target: AgentModelFreeTextTarget;
  value: ModelMenuValue;
};

type PickerItem = PickerModelItem | PickerFreeTextItem;

type PickerSection = {
  id: string;
  title?: string;
  items: PickerItem[];
};

function toModelItem({
  sectionId,
  row,
}: {
  sectionId: string;
  row: AgentModelCatalogRow;
}): PickerModelItem {
  return {
    kind: "model",
    id: `${sectionId}${ITEM_ID_SEPARATOR}${row.key}`,
    row,
    value: toAgentModelMenuValue(row),
  };
}

/**
 * The picker's sections.
 * - Empty query and no scope: Current (always, even when it isn't in the
 *   catalog), Recent (without the current model) and Recommended.
 * - Otherwise: one flat ranked list (capped, except when browsing a scope
 *   with no query) plus the "Use `x` with <provider>" row.
 *
 * @param params - inputs
 * @param params.rows - the catalog
 * @param params.providers - the provider options
 * @param params.recommendedRows - the curated models in the catalog, in order
 * @param params.currentRow - the selected model's row, if any
 * @param params.recentRows - recent picks to show, without the current model
 * @param params.recentModelKeys - every stored recent pick's key, newest first
 * @param params.query - the search text
 * @param params.scope - the provider search is limited to, if any
 */
function buildPickerSections({
  rows,
  providers,
  recommendedRows,
  currentRow,
  recentRows,
  recentModelKeys,
  query,
  scope,
}: {
  rows: readonly AgentModelCatalogRow[];
  providers: readonly AgentModelProviderOption[];
  recommendedRows: readonly AgentModelCatalogRow[];
  currentRow: AgentModelCatalogRow | null;
  recentRows: readonly AgentModelCatalogRow[];
  recentModelKeys: readonly string[];
  query: string;
  scope: AgentModelScope | null;
}): PickerSection[] {
  const isQueryEmpty = query.trim().length === 0;
  if (isQueryEmpty && !scope) {
    const sections: PickerSection[] = [];
    if (currentRow) {
      sections.push({
        id: "current",
        title: "Current",
        items: [toModelItem({ sectionId: "current", row: currentRow })],
      });
    }
    if (recentRows.length > 0) {
      sections.push({
        id: "recent",
        title: "Recent",
        items: recentRows.map((row) =>
          toModelItem({ sectionId: "recent", row })
        ),
      });
    }
    if (recommendedRows.length > 0) {
      sections.push({
        id: "recommended",
        title: "Recommended",
        items: recommendedRows.map((row) =>
          toModelItem({ sectionId: "recommended", row })
        ),
      });
    }
    return sections;
  }
  const rankedRows = rankAgentModels({
    rows,
    query,
    scope,
    recentModelKeys,
    // Browsing a whole provider lists all of it; the list scrolls
    ...(isQueryEmpty && { limit: Infinity }),
  });
  const freeTextTarget = getAgentModelFreeTextTarget({
    query,
    rows,
    providers,
    scope,
  });
  const sections: PickerSection[] = [
    {
      id: "results",
      items: rankedRows.map((row) =>
        toModelItem({ sectionId: "results", row })
      ),
    },
  ];
  if (freeTextTarget) {
    const value = toAgentModelMenuValue({
      provider: freeTextTarget.provider.provider,
      customProvider: freeTextTarget.provider.customProvider,
      modelName: freeTextTarget.modelName,
    });
    sections.push({
      id: "free-text",
      items: [
        {
          kind: "free-text",
          id: `free-text${ITEM_ID_SEPARATOR}${getAgentModelKeyForValue(value)}`,
          target: freeTextTarget,
          value,
        },
      ],
    });
  }
  return sections.filter((section) => section.items.length > 0);
}

function getScopeFromProviderOption(
  option: AgentModelProviderOption
): AgentModelScope {
  return {
    provider: option.provider,
    customProviderId: option.customProvider?.id ?? null,
  };
}

const FREE_TEXT_REASON_LABELS: Record<
  AgentModelFreeTextTarget["reason"],
  string
> = {
  guess: "Provider guessed from the name",
  scope: "Not a listed model",
  "first-ready": "First provider that's set up",
};

function getFreeTextReasonLabel(target: AgentModelFreeTextTarget): string {
  return target.provider.provider === "AZURE_OPENAI"
    ? "As a deployment name"
    : FREE_TEXT_REASON_LABELS[target.reason];
}

/** What a typed name is called for a provider: Azure takes deployment names. */
function getTypedNameNoun(option: AgentModelProviderOption | null): string {
  return option?.provider === "AZURE_OPENAI" ? "deployment" : "model";
}

/**
 * The trigger's accessible name: `Model: <display name> (<id>), <provider>`,
 * or `Model: <id>, <provider>` for a model without a display name.
 */
export function getAgentModelTriggerAriaLabel(
  row: Pick<AgentModelCatalogRow, "displayName" | "modelName" | "providerName">
): string {
  const name = row.displayName
    ? `${row.displayName} (${row.modelName})`
    : row.modelName;
  return `Model: ${name}, ${row.providerName}`;
}

const triggerCSS = css`
  min-width: 0;
  max-width: 100%;

  .agent-model-picker-trigger__content {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }

  .agent-model-picker-trigger__name {
    max-width: var(--global-dimension-size-2500);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .agent-model-picker-trigger__dot {
    flex: none;
    width: var(--global-dimension-size-75);
    height: var(--global-dimension-size-75);
    border-radius: 50%;
    background-color: var(--global-color-warning);
  }
`;

const pickerCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;

  .agent-model-picker__header {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    flex-shrink: 0;
    padding-left: var(--global-dimension-size-100);
    border-bottom: var(--global-border-size-thin) solid
      var(--global-menu-border-color);
  }

  .agent-model-picker__scope {
    flex: none;
    max-width: var(--global-dimension-size-1700);
  }

  .agent-model-picker__scope-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .agent-model-picker__search {
    flex: 1 1 auto;
    min-width: 0;
  }
`;

export type AgentChatModelPickerProps = {
  /** The selected model; an empty model name shows "Select a model" */
  value: ModelMenuValue;
  /** Called with the picked model, with the Bedrock prefix applied */
  onChange: (model: ModelMenuValue) => void;
  /**
   * The element the popover should fit inside (the chat input). The popover
   * is as wide as it, up to 380px.
   */
  popoverBoundaryRef?: RefObject<HTMLElement | null>;
};

/**
 * The PXI chat's model picker: a popover above the chat footer with search on
 * top. With no query it lists the current model, recent picks and the
 * curated models; typing searches every provider's models (see
 * `agentModelSearch`) and offers the query as a model name. A provider chip
 * at the start of the field scopes search and the typed name to one
 * provider.
 */
export function AgentChatModelPicker({
  value,
  onChange,
  popoverBoundaryRef,
}: AgentChatModelPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"models" | "providers">("models");
  const [query, setQuery] = useState("");
  const [providerQuery, setProviderQuery] = useState("");
  const [scopeKey, setScopeKey] = useState<string | null>(null);
  const [popoverWidth, setPopoverWidth] = useState(DEFAULT_POPOVER_MAX_WIDTH);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDisabled = useAgentContext((state) =>
    Object.values(state.chatStatusBySessionId).some(
      (status) => status === "submitted" || status === "streaming"
    )
  );
  const recentModels = useAgentContext((state) => state.recentModels);
  const recordRecentModel = useAgentContext((state) => state.recordRecentModel);
  const awsBedrockModelPrefix = usePreferencesContext(
    (state) => state.awsBedrockModelPrefix
  );
  const { customProviders, data } = useModelMenuData({
    credentialSource: "server",
  });

  const rows = useMemo(
    () =>
      buildAgentModelCatalog({
        playgroundModels: data.playgroundModels,
        modelProviders: data.modelProviders,
        customProviders,
      }),
    [data.playgroundModels, data.modelProviders, customProviders]
  );
  const providers = useMemo(
    () =>
      buildAgentModelProviderOptions({
        modelProviders: data.modelProviders,
        customProviders,
      }),
    [data.modelProviders, customProviders]
  );
  const recommendedRows = useMemo(() => {
    const rowsByKey = new Map(rows.map((row) => [row.key, row]));
    return getCuratedBuiltInModels(data.playgroundModels).flatMap((model) => {
      const row = rowsByKey.get(getAgentModelKey(model));
      return row ? [row] : [];
    });
  }, [rows, data.playgroundModels]);

  const currentModel = value.modelName ? value : null;
  const currentRow = currentModel
    ? resolveAgentModelRow({ model: currentModel, rows, providers })
    : null;
  // `recentModels` is selected as stored, so the selector never returns a
  // fresh array; what the picker shows is derived here
  const { recentRows, recentModelKeys } = useMemo(
    () => ({
      recentRows: getRecentAgentModels({ recentModels, currentModel }).map(
        (model) => resolveAgentModelRow({ model, rows, providers })
      ),
      recentModelKeys: recentModels.map(getAgentModelKeyForValue),
    }),
    [recentModels, currentModel, rows, providers]
  );

  const scopeOption = scopeKey
    ? (providers.find((option) => option.key === scopeKey) ?? null)
    : null;
  const scope = scopeOption ? getScopeFromProviderOption(scopeOption) : null;

  const sections = buildPickerSections({
    rows,
    providers,
    recommendedRows,
    currentRow,
    recentRows,
    recentModelKeys,
    query,
    scope,
  });
  const itemsById = new Map(
    sections.flatMap((section) => section.items.map((item) => [item.id, item]))
  );

  const applyPrefix = (model: ModelMenuValue): ModelMenuValue =>
    model.provider === "AWS" && awsBedrockModelPrefix
      ? {
          ...model,
          modelName: applyBedrockModelPrefix({
            modelName: model.modelName,
            prefix: awsBedrockModelPrefix,
          }),
        }
      : model;

  // A row is checked when it is the current model as stored or as it would
  // be sent (a Bedrock row picked with the region prefix applied)
  const currentKey = currentModel
    ? getAgentModelKeyForValue(currentModel)
    : null;
  const selectedItemIds = [...itemsById.values()]
    .filter(
      (item) =>
        currentKey != null &&
        (getAgentModelKeyForValue(item.value) === currentKey ||
          getAgentModelKeyForValue(applyPrefix(item.value)) === currentKey)
    )
    .map((item) => item.id);

  const openPicker = (initialQuery: string) => {
    const boundaryWidth =
      popoverBoundaryRef?.current?.getBoundingClientRect().width ?? 0;
    setPopoverWidth(
      boundaryWidth > 0
        ? Math.min(DEFAULT_POPOVER_MAX_WIDTH, boundaryWidth)
        : DEFAULT_POPOVER_MAX_WIDTH
    );
    setQuery(initialQuery);
    setIsOpen(true);
  };

  const handleOpenChange = (isNextOpen: boolean) => {
    if (isNextOpen) {
      openPicker("");
      return;
    }
    setIsOpen(false);
    setMode("models");
    setQuery("");
    setProviderQuery("");
    setScopeKey(null);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent) => {
    // Typing on the focused trigger opens the picker with that character in
    // the field. Space still opens it normally.
    const isPrintableKey =
      event.key.length === 1 &&
      event.key !== " " &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey;
    if (!isOpen && isPrintableKey) {
      event.preventDefault();
      openPicker(event.key);
    }
  };

  const showModels = () => {
    setMode("models");
    setProviderQuery("");
    inputRef.current?.focus();
  };

  const toggleProviders = () => {
    if (mode === "providers") {
      showModels();
      return;
    }
    setMode("providers");
    inputRef.current?.focus();
  };

  // Runs before the field's own handling: Escape steps back out of the
  // provider list and the scope before the popover closes on the next press,
  // and Backspace in an empty field opens the provider list
  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    const isFieldEmpty =
      (mode === "providers" ? providerQuery : query).length === 0;
    if (!isFieldEmpty) {
      return;
    }
    if (event.key === "Escape") {
      if (mode === "providers") {
        event.preventDefault();
        event.stopPropagation();
        showModels();
      } else if (scopeKey) {
        event.preventDefault();
        event.stopPropagation();
        setScopeKey(null);
      }
      return;
    }
    if (
      event.key === "Backspace" &&
      mode === "models" &&
      event.target === inputRef.current
    ) {
      event.preventDefault();
      setMode("providers");
    }
  };

  const handleModelAction = (key: Key) => {
    const item = itemsById.get(String(key));
    if (!item) {
      return;
    }
    const model = applyPrefix(item.value);
    onChange(model);
    recordRecentModel(model);
  };

  const handleProviderAction = (key: Key) => {
    setScopeKey(key === ALL_PROVIDERS_KEY ? null : String(key));
    showModels();
  };

  const isProviderMode = mode === "providers";
  const placeholder = isProviderMode
    ? "Filter providers"
    : scopeOption
      ? `Search ${scopeOption.name}, or type a ${getTypedNameNoun(scopeOption)} name`
      : "Search, or type any model name";
  const emptyDescription =
    scopeOption && query.trim().length === 0
      ? `${scopeOption.name} has no listed models. Type a ${getTypedNameNoun(scopeOption)} name.`
      : "No models match";

  return (
    <MenuTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button
        size="S"
        variant="quiet"
        css={triggerCSS}
        isDisabled={isDisabled}
        aria-label={
          currentRow
            ? getAgentModelTriggerAriaLabel(currentRow)
            : "Select model"
        }
        onKeyDown={handleTriggerKeyDown}
      >
        {currentRow ? (
          <AgentModelTriggerContent row={currentRow} />
        ) : (
          <Text color="text-700">Select a model</Text>
        )}
      </Button>
      <MenuContainer
        placement="top start"
        shouldFlip={false}
        minHeight={0}
        minWidth={popoverWidth}
        maxWidth={popoverWidth}
      >
        <div css={pickerCSS} onKeyDownCapture={handleKeyDownCapture}>
          <Autocomplete
            inputValue={isProviderMode ? providerQuery : query}
            onInputChange={isProviderMode ? setProviderQuery : setQuery}
          >
            <div className="agent-model-picker__header">
              <AgentModelScopeChip
                scopeOption={scopeOption}
                isExpanded={isProviderMode}
                onPress={toggleProviders}
              />
              <SearchField
                className="agent-model-picker__search"
                aria-label={
                  isProviderMode ? "Filter providers" : "Search models"
                }
                variant="quiet"
                size="L"
                autoFocus
              >
                <Input ref={inputRef} placeholder={placeholder} />
              </SearchField>
            </div>
            {isProviderMode ? (
              <AgentModelProviderMenu
                providers={providers}
                providerQuery={providerQuery}
                scopeKey={scopeKey}
                onAction={handleProviderAction}
              />
            ) : (
              <AgentModelResultsMenu
                sections={sections}
                query={query}
                selectedItemIds={selectedItemIds}
                emptyDescription={emptyDescription}
                onAction={handleModelAction}
              />
            )}
          </Autocomplete>
        </div>
      </MenuContainer>
    </MenuTrigger>
  );
}

/** The trigger's icon, label and the warning dot for unverified models. */
function AgentModelTriggerContent({ row }: { row: AgentModelCatalogRow }) {
  const showWarningDot =
    !row.isCurated ||
    row.credentialState === "no-key" ||
    row.isProviderMissing === true;
  return (
    <span className="agent-model-picker-trigger__content">
      {row.isProviderMissing ? null : (
        <AgentModelProviderIcon provider={row.provider} />
      )}
      <span className="agent-model-picker-trigger__name">
        {row.displayName ?? row.modelName}
      </span>
      {showWarningDot ? (
        <span className="agent-model-picker-trigger__dot" aria-hidden />
      ) : null}
    </span>
  );
}

/**
 * The provider chip at the start of the search field. Pressing it toggles
 * the provider list that sets the search scope.
 */
function AgentModelScopeChip({
  scopeOption,
  isExpanded,
  onPress,
}: {
  scopeOption: AgentModelProviderOption | null;
  isExpanded: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      size="S"
      className="agent-model-picker__scope"
      aria-label={
        scopeOption
          ? `Provider: ${scopeOption.name}. Change provider`
          : "Provider: all providers. Choose a provider"
      }
      aria-expanded={isExpanded}
      leadingVisual={
        scopeOption ? (
          <AgentModelProviderIcon provider={scopeOption.provider} />
        ) : undefined
      }
      trailingVisual={<Icon svg={<Icons.ChevronDownSmall />} />}
      onPress={onPress}
    >
      <span className="agent-model-picker__scope-name">
        {scopeOption?.name ?? "All"}
      </span>
    </Button>
  );
}

/** The provider list shown in place of the models while choosing a scope. */
function AgentModelProviderMenu({
  providers,
  providerQuery,
  scopeKey,
  onAction,
}: {
  providers: readonly AgentModelProviderOption[];
  providerQuery: string;
  scopeKey: string | null;
  onAction: (key: Key) => void;
}) {
  const normalizedQuery = providerQuery.trim().toLowerCase();
  // Ready providers first, then may-work, then no-key; otherwise in order
  const filteredProviders = providers
    .filter((option) => option.name.toLowerCase().includes(normalizedQuery))
    .toSorted(
      (first, second) =>
        getCredentialStateOrder(first.credentialState) -
        getCredentialStateOrder(second.credentialState)
    );
  return (
    <Menu
      aria-label="Providers"
      selectionMode="single"
      // The checked row is a setting, not a filter: Escape must close the
      // picker rather than clear it
      escapeKeyBehavior="none"
      selectedKeys={[scopeKey ?? ALL_PROVIDERS_KEY]}
      shouldCloseOnSelect={false}
      onAction={onAction}
      renderEmptyState={() => (
        <CompactEmptyState
          icon={<Icon svg={<Icons.Search />} />}
          description="No providers match"
        />
      )}
    >
      {normalizedQuery ? null : (
        <MenuItem id={ALL_PROVIDERS_KEY} textValue="All providers">
          <AgentModelRowLayout
            leadingVisual={<Icon svg={<Icons.Search />} />}
            name="All providers"
          />
        </MenuItem>
      )}
      {filteredProviders.map((option) => (
        <MenuItem key={option.key} id={option.key} textValue={option.name}>
          <AgentModelRowLayout
            leadingVisual={
              <AgentModelProviderIcon provider={option.provider} />
            }
            name={option.name}
            secondary={option.customProvider ? "Custom provider" : undefined}
            trailing={
              <AgentModelCredentialHint
                credentialState={option.credentialState}
              />
            }
          />
        </MenuItem>
      ))}
    </Menu>
  );
}

/** The model list: the empty-query sections, or ranked results. */
function AgentModelResultsMenu({
  sections,
  query,
  selectedItemIds,
  emptyDescription,
  onAction,
}: {
  sections: readonly PickerSection[];
  query: string;
  selectedItemIds: readonly string[];
  emptyDescription: string;
  onAction: (key: Key) => void;
}) {
  return (
    <Menu
      aria-label="Models"
      selectionMode="single"
      // The checked row is a setting, not a filter: Escape must close the
      // picker rather than clear it
      escapeKeyBehavior="none"
      selectedKeys={selectedItemIds}
      onAction={onAction}
      renderEmptyState={() => (
        <CompactEmptyState
          icon={<Icon svg={<Icons.Search />} />}
          description={emptyDescription}
        />
      )}
    >
      {sections.map((section) => (
        <MenuSection key={section.id} id={section.id}>
          {section.title ? <MenuSectionTitle title={section.title} /> : null}
          {section.items.map((item) =>
            item.kind === "model" ? (
              <MenuItem
                key={item.id}
                id={item.id}
                textValue={`${item.row.displayName ?? item.row.modelName}, ${item.row.providerName}`}
              >
                <AgentModelRow
                  row={item.row}
                  query={query}
                  showRecommendedBadge={section.id === "results"}
                />
              </MenuItem>
            ) : (
              <MenuItem
                key={item.id}
                id={item.id}
                textValue={`Use ${item.target.modelName} with ${item.target.provider.name}`}
              >
                <AgentModelRowLayout
                  leadingVisual={
                    <AgentModelProviderIcon
                      provider={item.target.provider.provider}
                    />
                  }
                  name={`Use "${item.target.modelName}" with ${item.target.provider.name}`}
                  secondary={getFreeTextReasonLabel(item.target)}
                  trailing={
                    <AgentModelCredentialHint
                      credentialState={item.target.provider.credentialState}
                    />
                  }
                />
              </MenuItem>
            )
          )}
        </MenuSection>
      ))}
    </Menu>
  );
}
