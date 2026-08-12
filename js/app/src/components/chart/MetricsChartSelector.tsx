import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import { css } from "@emotion/react";
import type { ReactNode, Ref } from "react";
import { useState } from "react";
import type { Key, Selection } from "react-aria-components";
import { MenuSection } from "react-aria-components";

import {
  Autocomplete,
  Flex,
  Icon,
  Icons,
  Input,
  Menu,
  MenuFooter,
  MenuHeader,
  MenuItem,
  MenuSectionTitle,
  SearchField,
  Separator,
  Text,
  useFilter,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchIcon } from "@phoenix/components/core/field";
import {
  dndDragFeedbackCSS,
  dndRowHandleCSS,
  ReorderProvider,
} from "@phoenix/components/dnd";

import type { ChartTypeIconType } from "./ChartTypeIcon";
import { ChartTypeIcon } from "./ChartTypeIcon";

/**
 * The minimal shape a chart option must have to appear in a
 * {@link MetricsChartSelector}. Any richer catalog entry (e.g. one that also
 * carries a Component to render) is structurally compatible.
 */
export interface ChartSelectorOption<K extends Key = Key> {
  key: K;
  /** Shown as the option's primary label. */
  name: string;
  /** Shown as the option's secondary label. */
  description: string;
  /**
   * The chart's visual archetype, used to render a small preview glyph so a
   * chart can be recognized by its shape.
   */
  chartType: ChartTypeIconType;
}

const chartMenuItemContentCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-25);
  min-width: 0;
`;

const chartMenuItemIconCSS = css`
  margin-inline: var(--global-dimension-size-50)
    var(--global-dimension-size-100);
`;

const chartMenuItemCSS = css`
  ${dndDragFeedbackCSS}
  /* Doubled to out-specify the menu item's own hover background, which the
     dragged copy keeps while the pointer is over it */
  &&[data-dnd-dragging] {
    background-color: var(--global-menu-background-color);
  }
  .chart-menu-item__handle {
    ${dndRowHandleCSS}
  }
  &[data-hovered] .chart-menu-item__handle,
  &[data-focused] .chart-menu-item__handle {
    opacity: 1;
  }
`;

function ChartMenuItem<K extends Key>({
  option,
  ref,
  trailingContent,
}: {
  option: ChartSelectorOption<K>;
  ref?: Ref<HTMLDivElement>;
  /** Rendered at the end of the row, e.g. a drag handle. */
  trailingContent?: ReactNode;
}) {
  return (
    <MenuItem
      id={option.key}
      ref={ref}
      textValue={`${option.name} ${option.description}`}
      css={chartMenuItemCSS}
      leadingContent={
        <ChartTypeIcon
          type={option.chartType}
          size={22}
          css={chartMenuItemIconCSS}
        />
      }
      trailingContent={trailingContent}
    >
      <div css={chartMenuItemContentCSS}>
        <Text>{option.name}</Text>
        <Text size="XS" color="text-700">
          {option.description}
        </Text>
      </div>
    </MenuItem>
  );
}

/** Shared so every sortable row passes the same array identity to dnd-kit. */
const SORTABLE_MODIFIERS = [RestrictToVerticalAxis];

/**
 * A chart row in the "Selected" section, draggable by its handle to change the
 * order the charts are displayed in.
 *
 * The handle is deliberately not focusable: a menu owns its own keyboard
 * navigation, so nothing inside a menu item can be tabbed to. Reordering is
 * therefore pointer-only here.
 */
function SortableChartMenuItem<K extends Key>({
  option,
  index,
  isReorderingDisabled,
}: {
  option: ChartSelectorOption<K>;
  index: number;
  isReorderingDisabled: boolean;
}) {
  const { ref, handleRef } = useSortable({
    id: option.key,
    index,
    disabled: isReorderingDisabled,
    modifiers: SORTABLE_MODIFIERS,
  });
  return (
    <ChartMenuItem
      option={option}
      ref={ref}
      trailingContent={
        isReorderingDisabled ? null : (
          <span
            ref={handleRef}
            className="chart-menu-item__handle"
            aria-hidden="true"
            // Keep a press on the handle from also toggling the chart. dnd-kit
            // listens on the handle itself, so it still sees the event.
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Icon svg={<Icons.DragHandle />} />
          </span>
        )
      }
    />
  );
}

/**
 * A searchable menu to select which charts from a catalog are shown, and in
 * what order.
 *
 * Rows do NOT jump between the "Selected" and "Available" sections as they are
 * toggled: the partition is snapshotted when the menu opens (this component
 * mounts) and stays fixed while it is open, so toggling a chart only flips its
 * checkmark in place. The next time the menu opens, the sections re-snapshot to
 * reflect the current selection. This mirrors GitHub's label picker.
 *
 * Charts in the "Selected" section can be dragged by their handle to reorder
 * them; a chart turned on from "Available" is appended to the end of the
 * selection. Reordering is disabled while the list is filtered, where the
 * visible rows are only part of the order.
 *
 * The component is store-agnostic: it renders the `options` it is given and
 * reports selection changes up. Wrap it with a connected component to bind it
 * to a particular catalog and selection store.
 */
export function MetricsChartSelector<K extends Key>({
  options,
  selectedKeys,
  onSelectionChange,
  maxSelected,
}: {
  /** The charts to choose from, in catalog order. */
  options: readonly ChartSelectorOption<K>[];
  /**
   * The selected charts, in the order they are displayed in. Reordering and
   * newly selected charts are reported back through `onSelectionChange`.
   */
  selectedKeys: readonly K[];
  onSelectionChange: (keys: K[]) => void;
  /**
   * The maximum number of charts that can be selected at once. Unlimited
   * when omitted.
   */
  maxSelected?: number;
}) {
  const { contains } = useFilter({ sensitivity: "base" });
  // Reordering a filtered list is ambiguous, so it is only enabled while the
  // full list is shown
  const [isFiltered, setIsFiltered] = useState(false);

  // Freeze which section each chart belongs to at open time so rows stay put
  // while the menu is open. This component remounts on every open (the popover
  // unmounts its content on close), so the snapshot is fresh each time.
  // Dragging reorders this list; a chart unchecked while the menu is open keeps
  // its slot in it until the menu is reopened.
  const [sectionOrder, setSectionOrder] = useState<K[]>(() => {
    // Drop keys with no option so every row has an index matching this order
    const optionKeys = new Set<Key>(options.map((option) => option.key));
    return selectedKeys.filter((key) => optionKeys.has(key));
  });
  const sectionKeySet = new Set<Key>(sectionOrder);

  const selectedKeySet = new Set<Key>(selectedKeys);
  const optionsByKey = new Map(options.map((option) => [option.key, option]));
  const selectedSectionCharts = sectionOrder
    .map((key) => optionsByKey.get(key))
    .filter((option) => option != null);
  const availableSectionCharts = options.filter(
    (option) => !sectionKeySet.has(option.key)
  );

  const hasSelectionLimit = maxSelected != null;
  const isAtMax = hasSelectionLimit && selectedKeys.length >= maxSelected;
  // When at the limit, prevent adding more by disabling the charts that are
  // not currently selected. Already-selected charts stay toggleable so the
  // user can swap one out.
  const disabledKeys = isAtMax
    ? options
        .filter((option) => !selectedKeySet.has(option.key))
        .map((option) => option.key)
    : [];

  /**
   * The keys to report up for a given selection: the "Selected" section keeps
   * its own (drag-reorderable) order, charts turned on from "Available" follow
   * it in the order they were added, and anything newly checked goes last.
   */
  const toDisplayOrder = (order: readonly K[], keys: Set<Key>) =>
    [
      ...order,
      ...selectedKeys.filter((key) => !sectionKeySet.has(key)),
      ...options
        .map((option) => option.key)
        .filter((key) => !sectionKeySet.has(key) && !selectedKeySet.has(key)),
    ]
      .filter((key) => keys.has(key))
      .slice(0, maxSelected ?? Infinity);

  const handleSelectionChange = (selection: Selection) => {
    const nextKeys =
      selection === "all"
        ? new Set<Key>(options.map((option) => option.key))
        : selection;
    onSelectionChange(toDisplayOrder(sectionOrder, nextKeys));
  };

  const handleOrderCommit = (nextSectionOrder: K[]) => {
    const nextKeys = toDisplayOrder(nextSectionOrder, selectedKeySet);
    // A canceled or round-trip drag ends on the order it started with; skip the
    // update so the selection is not re-persisted for an unchanged order.
    if (nextKeys.some((key, index) => selectedKeys[index] !== key)) {
      onSelectionChange(nextKeys);
    }
  };

  const hasSelectedSection = selectedSectionCharts.length > 0;
  // A single row has no order to change, and a filtered list only shows part
  // of the order
  const isReorderingDisabled = selectedSectionCharts.length < 2 || isFiltered;

  return (
    <>
      <Autocomplete
        filter={contains}
        onInputChange={(value) => setIsFiltered(value.trim() !== "")}
      >
        <MenuHeader>
          <SearchField aria-label="Search charts" variant="quiet" autoFocus>
            <SearchIcon />
            <Input placeholder="Filter charts" />
          </SearchField>
        </MenuHeader>
        {/* The rows preview the new order as the drag goes; the selection is
            only reported up at drag end so the charts behind the menu are not
            re-rendered (and re-persisted) on every drag-over step. */}
        <ReorderProvider
          order={sectionOrder}
          onOrderChange={setSectionOrder}
          onOrderCommit={handleOrderCommit}
        >
          <Menu
            aria-label="Metric charts"
            selectionMode="multiple"
            // The selection is a persisted setting, so Escape should close the
            // menu rather than clear every chart
            escapeKeyBehavior="none"
            selectedKeys={selectedKeySet}
            disabledKeys={disabledKeys}
            onSelectionChange={handleSelectionChange}
            renderEmptyState={() => (
              <CompactEmptyState
                icon={<Icon svg={<Icons.BarChart />} />}
                description="No charts found"
              />
            )}
          >
            {hasSelectedSection && (
              <>
                <MenuSection>
                  <MenuSectionTitle title="Selected" />
                  {selectedSectionCharts.map((option, index) => (
                    <SortableChartMenuItem
                      key={option.key}
                      option={option}
                      index={index}
                      isReorderingDisabled={isReorderingDisabled}
                    />
                  ))}
                </MenuSection>
                <Separator />
              </>
            )}
            <MenuSection>
              {hasSelectedSection && <MenuSectionTitle title="Available" />}
              {availableSectionCharts.map((option) => (
                <ChartMenuItem key={option.key} option={option} />
              ))}
            </MenuSection>
          </Menu>
        </ReorderProvider>
      </Autocomplete>
      <MenuFooter>
        <Flex
          direction="row"
          justifyContent={hasSelectionLimit ? "space-between" : "end"}
          alignItems="center"
        >
          {hasSelectionLimit && (
            <Text size="XS" color="text-500">
              Show up to {maxSelected} charts
            </Text>
          )}
          <Text size="XS" color="text-700">
            {hasSelectionLimit
              ? `${selectedKeys.length}/${maxSelected} selected`
              : `${selectedKeys.length} selected`}
          </Text>
        </Flex>
      </MenuFooter>
    </>
  );
}
