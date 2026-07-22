import { css } from "@emotion/react";
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

function ChartMenuItem<K extends Key>({
  option,
}: {
  option: ChartSelectorOption<K>;
}) {
  return (
    <MenuItem
      id={option.key}
      textValue={`${option.name} ${option.description}`}
      leadingContent={
        <ChartTypeIcon
          type={option.chartType}
          size={22}
          css={chartMenuItemIconCSS}
        />
      }
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

/**
 * A searchable menu to select which charts from a catalog are shown. Allows up
 * to `maxSelected` charts to be selected at once.
 *
 * Rows do NOT jump between the "Selected" and "Available" sections as they are
 * toggled: the partition is snapshotted when the menu opens (this component
 * mounts) and stays fixed while it is open, so toggling a chart only flips its
 * checkmark in place. The next time the menu opens, the sections re-snapshot to
 * reflect the current selection. This mirrors GitHub's label picker.
 *
 * The component is store-agnostic: it renders the `options` it is given, in the
 * order they are given, and reports selection changes up. Wrap it with a
 * connected component to bind it to a particular catalog and selection store.
 */
export function MetricsChartSelector<K extends Key>({
  options,
  selectedKeys,
  onSelectionChange,
  maxSelected = 3,
}: {
  /** The charts to choose from, in display order. */
  options: readonly ChartSelectorOption<K>[];
  selectedKeys: readonly K[];
  onSelectionChange: (keys: K[]) => void;
  /**
   * The maximum number of charts that can be selected at once.
   * @default 3
   */
  maxSelected?: number;
}) {
  const { contains } = useFilter({ sensitivity: "base" });

  // Freeze which section each chart belongs to at open time so rows stay put
  // while the menu is open. This component remounts on every open (the popover
  // unmounts its content on close), so the snapshot is fresh each time.
  const [sectionSnapshot] = useState<Set<Key>>(() => new Set(selectedKeys));

  const selectedKeySet = new Set<Key>(selectedKeys);
  const selectedSectionCharts = options.filter((option) =>
    sectionSnapshot.has(option.key)
  );
  const availableSectionCharts = options.filter(
    (option) => !sectionSnapshot.has(option.key)
  );

  const isAtMax = selectedKeys.length >= maxSelected;
  // When at the limit, prevent adding more by disabling the charts that are
  // not currently selected. Already-selected charts stay toggleable so the
  // user can swap one out.
  const disabledKeys = isAtMax
    ? options
        .filter((option) => !selectedKeySet.has(option.key))
        .map((option) => option.key)
    : [];

  const handleSelectionChange = (selection: Selection) => {
    // Normalize to catalog order so the charts display in a stable order, and
    // cap at the selection limit.
    const orderedKeys = options.map((option) => option.key);
    const nextKeys =
      selection === "all"
        ? orderedKeys
        : orderedKeys.filter((key) => selection.has(key));
    onSelectionChange(nextKeys.slice(0, maxSelected));
  };

  const hasSelectedSection = selectedSectionCharts.length > 0;

  return (
    <>
      <Autocomplete filter={contains}>
        <MenuHeader>
          <SearchField aria-label="Search charts" variant="quiet" autoFocus>
            <SearchIcon />
            <Input placeholder="Filter charts" />
          </SearchField>
        </MenuHeader>
        <Menu
          aria-label="Metric charts"
          selectionMode="multiple"
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
                {selectedSectionCharts.map((option) => (
                  <ChartMenuItem key={option.key} option={option} />
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
      </Autocomplete>
      <MenuFooter>
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Text size="XS" color="text-500">
            Show up to {maxSelected} charts
          </Text>
          <Text size="XS" color="text-700">
            {selectedKeys.length}/{maxSelected} selected
          </Text>
        </Flex>
      </MenuFooter>
    </>
  );
}
