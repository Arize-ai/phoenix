import { css } from "@emotion/react";
import uniqBy from "lodash/uniqBy";
import type { KeyboardEvent, RefObject } from "react";
import { useState } from "react";
import type { Key, PopoverProps } from "react-aria-components";
import { MenuSection, SubmenuTrigger } from "react-aria-components";

import {
  Autocomplete,
  Button,
  Icon,
  Icons,
  Input,
  Menu,
  MenuContainer,
  MenuHeader,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
  SearchField,
  Text,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchIcon } from "@phoenix/components/core/field";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { applyBedrockModelPrefix } from "@phoenix/components/generative/modelProviderUtils";
import { useModelMenuData } from "@phoenix/components/generative/useModelMenuData";
import { usePreferencesContext } from "@phoenix/contexts";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { getCuratedBuiltInModels } from "./agentCuratedModels";
import {
  DEFAULT_RECENT_AGENT_MODELS_SHOWN,
  getAgentModelKey,
  getAgentModelKeyForValue,
} from "./agentModelConfig";
import {
  AgentModelCredentialHint,
  AgentModelProviderIcon,
  AgentModelRow,
  AgentModelRowLayout,
} from "./AgentModelPickerRow";
import {
  type AgentModelCatalogRow,
  type AgentModelCustomModelOption,
  type AgentModelProviderOption,
  buildAgentModelCatalog,
  buildAgentModelProviderOptions,
  getAgentModelCustomModelOption,
  rankAgentModels,
  resolveAgentModelRow,
  toAgentModelMenuValue,
} from "./agentModelSearch";

/** The popover's width when the boundary is wider (or not given). */
const DEFAULT_POPOVER_MAX_WIDTH = 380;

/**
 * Joins a section id and a model key into a menu item id. A private-use
 * character, so it can't occur in a model key.
 */
const ITEM_ID_SEPARATOR = "\uE000";

/** The id of the "Use `x` as a custom model" row. */
const CUSTOM_MODEL_ITEM_ID = "custom-model";

type PickerModelItem = {
  kind: "model";
  id: string;
  row: AgentModelCatalogRow;
  /** The value to emit, before the Bedrock prefix */
  value: ModelMenuValue;
};

type PickerCustomModelItem = {
  kind: "custom-model";
  id: string;
  option: AgentModelCustomModelOption;
};

type PickerItem = PickerModelItem | PickerCustomModelItem;

type PickerSection = {
  id: string;
  title?: string;
  /** Whether curated rows show the "Recommended" badge */
  showRecommendedBadge: boolean;
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
 * - Empty query: Current (always, even when it isn't in the catalog), Recent
 *   (without the current model) and Recommended.
 * - Otherwise: one flat ranked list, then the "Use `x` as a custom model" row
 *   whose submenu lists the providers.
 *
 * @param params - inputs
 * @param params.rows - the catalog
 * @param params.providers - the provider options
 * @param params.recommendedRows - the curated models in the catalog, in order
 * @param params.currentRow - the selected model's row, if any
 * @param params.recentRows - recent picks to show, without the current model
 * @param params.recentModelKeys - every stored recent pick's key, newest first
 * @param params.query - the search text
 */
function buildPickerSections({
  rows,
  providers,
  recommendedRows,
  currentRow,
  recentRows,
  recentModelKeys,
  query,
}: {
  rows: readonly AgentModelCatalogRow[];
  providers: readonly AgentModelProviderOption[];
  recommendedRows: readonly AgentModelCatalogRow[];
  currentRow: AgentModelCatalogRow | null;
  recentRows: readonly AgentModelCatalogRow[];
  recentModelKeys: readonly string[];
  query: string;
}): PickerSection[] {
  const isQueryEmpty = query.trim().length === 0;
  if (isQueryEmpty) {
    const sections: PickerSection[] = [];
    if (currentRow) {
      sections.push({
        id: "current",
        title: "Current",
        showRecommendedBadge: false,
        items: [toModelItem({ sectionId: "current", row: currentRow })],
      });
    }
    if (recentRows.length > 0) {
      sections.push({
        id: "recent",
        title: "Recent",
        showRecommendedBadge: false,
        items: recentRows.map((row) =>
          toModelItem({ sectionId: "recent", row })
        ),
      });
    }
    if (recommendedRows.length > 0) {
      sections.push({
        id: "recommended",
        title: "Recommended",
        showRecommendedBadge: false,
        items: recommendedRows.map((row) =>
          toModelItem({ sectionId: "recommended", row })
        ),
      });
    }
    return sections;
  }
  const rankedRows = rankAgentModels({ rows, query, recentModelKeys });
  const customModelOption = getAgentModelCustomModelOption({
    query,
    providers,
  });
  const sections: PickerSection[] = [
    {
      id: "results",
      showRecommendedBadge: true,
      items: rankedRows.map((row) =>
        toModelItem({ sectionId: "results", row })
      ),
    },
  ];
  if (customModelOption) {
    sections.push({
      id: "custom",
      showRecommendedBadge: false,
      items: [
        {
          kind: "custom-model",
          id: CUSTOM_MODEL_ITEM_ID,
          option: customModelOption,
        },
      ],
    });
  }
  return sections.filter((section) => section.items.length > 0);
}

/**
 * The second line of a provider in the custom-model submenu: why it's first,
 * that Azure takes deployment names, or that it's a custom provider.
 */
function getCustomModelProviderNote({
  option,
  isGuessed,
}: {
  option: AgentModelProviderOption;
  isGuessed: boolean;
}): string | undefined {
  if (option.customProvider) {
    return "Custom provider";
  }
  if (option.provider === "AZURE_OPENAI") {
    return "As a deployment name";
  }
  return isGuessed ? "Guessed from the name" : undefined;
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
`;

export type AgentModelPickerProps = {
  /** The selected model; an empty model name shows "Select a model" */
  value: ModelMenuValue;
  /** Called with the picked model, with the Bedrock prefix applied */
  onChange: (model: ModelMenuValue) => void;
  /**
   * The element the popover should fit inside (the chat input). The popover
   * is as wide as it, up to 380px; without it, it is 380px wide.
   */
  popoverBoundaryRef?: RefObject<HTMLElement | null>;
  /**
   * Where the popover opens relative to the trigger.
   * @default "top start" (above the chat footer)
   */
  placement?: PopoverProps["placement"];
  /**
   * Whether the popover may flip to the other side when it doesn't fit.
   * @default false (the chat picker always opens upward)
   */
  shouldFlip?: boolean;
  /**
   * The trigger button's variant: borderless in the chat footer, bordered in
   * a form.
   * @default "quiet"
   */
  triggerVariant?: "default" | "quiet";
};

/**
 * The PXI model picker, used in the chat footer and in Settings: a popover
 * with search on top. With no query it lists the current model, recent picks and the
 * curated models; typing searches every provider's models (see
 * `agentModelSearch`). The last row of a search offers the query as a custom
 * model name, with a submenu (on hover, ArrowRight or Enter) to pick the
 * provider to send it to.
 */
export function AgentModelPicker({
  value,
  onChange,
  popoverBoundaryRef,
  placement = "top start",
  shouldFlip = false,
  triggerVariant = "quiet",
}: AgentModelPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [popoverWidth, setPopoverWidth] = useState(DEFAULT_POPOVER_MAX_WIDTH);

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

  const providers = buildAgentModelProviderOptions({
    modelProviders: data.modelProviders,
    customProviders,
  });
  const rows = buildAgentModelCatalog({
    playgroundModels: data.playgroundModels,
    providers,
    customProviders,
  });
  const rowsByKey = new Map(rows.map((row) => [row.key, row]));
  const recommendedRows = getCuratedBuiltInModels(
    data.playgroundModels
  ).flatMap((model) => {
    const row = rowsByKey.get(getAgentModelKey(model));
    return row ? [row] : [];
  });

  const currentModel = value.modelName ? value : null;
  const currentRow = currentModel
    ? resolveAgentModelRow({ model: currentModel, rows, providers })
    : null;
  // Recent rows resolve like the Current row, so drop the ones that resolve
  // to the current row or to an earlier recent row
  const recentRows = uniqBy(
    recentModels
      .map((model) => resolveAgentModelRow({ model, rows, providers }))
      .filter((row) => row.key !== currentRow?.key),
    (row) => row.key
  ).slice(0, DEFAULT_RECENT_AGENT_MODELS_SHOWN);
  const recentModelKeys = recentModels.map(getAgentModelKeyForValue);

  const sections = buildPickerSections({
    rows,
    providers,
    recommendedRows,
    currentRow,
    recentRows,
    recentModelKeys,
    query,
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

  // A row is checked when it is the Current row, which a Bedrock id with a
  // region prefix resolves to its catalog row
  const selectedItemIds = [...itemsById.values()]
    .filter(
      (item): item is PickerModelItem =>
        item.kind === "model" &&
        currentRow != null &&
        item.row.key === currentRow.key
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
    setQuery("");
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

  const selectModel = (selection: ModelMenuValue) => {
    onChange(applyPrefix(selection));
    // Recorded before the prefix, so a recent catalog pick gets the region
    // preference current when it's picked again. A typed name keeps the
    // region it was typed with.
    recordRecentModel(selection);
  };

  const handleModelAction = (key: Key) => {
    const item = itemsById.get(String(key));
    if (item?.kind === "model") {
      selectModel(item.value);
    }
  };

  const handleCustomModelProviderPick = ({
    modelName,
    provider,
  }: {
    modelName: string;
    provider: AgentModelProviderOption;
  }) => {
    selectModel(
      toAgentModelMenuValue({
        provider: provider.provider,
        customProvider: provider.customProvider,
        modelName,
      })
    );
  };

  return (
    <MenuTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button
        size="S"
        variant={triggerVariant}
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
        placement={placement}
        shouldFlip={shouldFlip}
        minHeight={0}
        minWidth={popoverWidth}
        maxWidth={popoverWidth}
      >
        <div css={pickerCSS}>
          <Autocomplete inputValue={query} onInputChange={setQuery}>
            <MenuHeader>
              <SearchField
                aria-label="Search models"
                variant="quiet"
                size="L"
                autoFocus
              >
                <SearchIcon />
                <Input placeholder="Search, or type any model name" />
              </SearchField>
            </MenuHeader>
            <AgentModelResultsMenu
              sections={sections}
              query={query}
              selectedItemIds={selectedItemIds}
              onAction={handleModelAction}
              onCustomModelProviderPick={handleCustomModelProviderPick}
            />
          </Autocomplete>
        </div>
      </MenuContainer>
    </MenuTrigger>
  );
}

/**
 * The trigger's icon, label and a warning dot for a model that can't run: its
 * provider has no key or no longer exists. Whether a model is recommended is
 * left to the picker's badge.
 */
function AgentModelTriggerContent({ row }: { row: AgentModelCatalogRow }) {
  const showWarningDot =
    row.credentialState === "no-key" || row.isProviderMissing === true;
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
 * The model list: the empty-query sections, or ranked results ending with
 * the custom-model row.
 */
function AgentModelResultsMenu({
  sections,
  query,
  selectedItemIds,
  onAction,
  onCustomModelProviderPick,
}: {
  sections: readonly PickerSection[];
  query: string;
  selectedItemIds: readonly string[];
  onAction: (key: Key) => void;
  onCustomModelProviderPick: (pick: {
    modelName: string;
    provider: AgentModelProviderOption;
  }) => void;
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
          description="No models match"
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
                  showRecommendedBadge={section.showRecommendedBadge}
                />
              </MenuItem>
            ) : (
              <AgentCustomModelSubmenu
                key={item.id}
                id={item.id}
                option={item.option}
                onPick={onCustomModelProviderPick}
              />
            )
          )}
        </MenuSection>
      ))}
    </Menu>
  );
}

/**
 * The "Use `x` as a custom model" row and its provider submenu, which opens
 * on hover, ArrowRight or Enter. Picking a provider sends the typed name to
 * it.
 */
function AgentCustomModelSubmenu({
  id,
  option,
  onPick,
}: {
  id: string;
  option: AgentModelCustomModelOption;
  onPick: (pick: {
    modelName: string;
    provider: AgentModelProviderOption;
  }) => void;
}) {
  const handleAction = (key: Key) => {
    const provider = option.providers.find(
      (candidate) => candidate.key === String(key)
    );
    if (provider) {
      onPick({ modelName: option.modelName, provider });
    }
  };
  return (
    <SubmenuTrigger>
      <MenuItem id={id} textValue={`Use ${option.modelName} as a custom model`}>
        <AgentModelRowLayout
          leadingVisual={<Icon svg={<Icons.Edit />} />}
          name={`Use "${option.modelName}" as a custom model`}
          secondary="Choose a provider"
        />
      </MenuItem>
      <MenuContainer minHeight={0} minWidth={260} maxWidth={320}>
        <Menu
          aria-label={`Providers for ${option.modelName}`}
          onAction={handleAction}
        >
          {option.providers.map((provider) => (
            <MenuItem
              key={provider.key}
              id={provider.key}
              textValue={provider.name}
            >
              <AgentModelRowLayout
                leadingVisual={
                  <AgentModelProviderIcon provider={provider.provider} />
                }
                name={provider.name}
                secondary={getCustomModelProviderNote({
                  option: provider,
                  isGuessed: provider.key === option.guessedProviderKey,
                })}
                trailing={
                  <AgentModelCredentialHint
                    credentialState={provider.credentialState}
                  />
                }
              />
            </MenuItem>
          ))}
        </Menu>
      </MenuContainer>
    </SubmenuTrigger>
  );
}
