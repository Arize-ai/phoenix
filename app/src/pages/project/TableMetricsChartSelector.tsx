import { css } from "@emotion/react";
import type { Selection } from "react-aria-components";
import { MenuSection } from "react-aria-components";

import {
  Autocomplete,
  Button,
  Flex,
  Icon,
  Icons,
  Input,
  Menu,
  MenuContainer,
  MenuFooter,
  MenuHeader,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
  SearchField,
  Separator,
  Text,
  useFilter,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchIcon } from "@phoenix/components/core/field";
import { useProjectContext } from "@phoenix/contexts/ProjectContext";

import type { MetricChartTableView } from "./constants";
import { MAX_SELECTED_METRIC_CHARTS } from "./constants";
import type { ProjectMetricChart } from "./metrics/chartCatalog";
import { PROJECT_METRIC_CHARTS } from "./metrics/chartCatalog";

const chartMenuItemContentCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-static-size-25);
  padding: var(--global-dimension-static-size-50)
    var(--global-dimension-static-size-100);
`;

function ChartMenuItem({ chart }: { chart: ProjectMetricChart }) {
  return (
    <MenuItem id={chart.key} textValue={`${chart.name} ${chart.description}`}>
      <div css={chartMenuItemContentCSS}>
        <Text>{chart.name}</Text>
        <Text size="XS" color="text-700">
          {chart.description}
        </Text>
      </div>
    </MenuItem>
  );
}

/**
 * A searchable menu to select which charts from the chart catalog are shown
 * above a project table. Allows up to MAX_SELECTED_METRIC_CHARTS charts to be
 * selected at once.
 */
export function TableMetricsChartSelector({
  view,
}: {
  view: MetricChartTableView;
}) {
  return (
    <MenuTrigger>
      <Button aria-label="Select metric charts">
        <Flex direction="row" alignItems="center" gap="size-100">
          <Icon svg={<Icons.BarChart />} />
          Charts
        </Flex>
      </Button>
      <MenuContainer placement="bottom end">
        <ChartSelectorMenu view={view} />
      </MenuContainer>
    </MenuTrigger>
  );
}

function ChartSelectorMenu({ view }: { view: MetricChartTableView }) {
  const { contains } = useFilter({ sensitivity: "base" });
  const selectedChartKeys = useProjectContext(
    (state) => state.metricChartKeys[view]
  );
  const setMetricChartKeys = useProjectContext(
    (state) => state.setMetricChartKeys
  );
  const selectedCharts = PROJECT_METRIC_CHARTS.filter((chart) =>
    selectedChartKeys.includes(chart.key)
  );
  const unselectedCharts = PROJECT_METRIC_CHARTS.filter(
    (chart) => !selectedChartKeys.includes(chart.key)
  );
  const isAtMax = selectedChartKeys.length >= MAX_SELECTED_METRIC_CHARTS;
  const disabledKeys = isAtMax
    ? PROJECT_METRIC_CHARTS.map((chart) => chart.key).filter(
        (key) => !selectedChartKeys.includes(key)
      )
    : [];

  const onSelectionChange = (selection: Selection) => {
    const catalogKeys = PROJECT_METRIC_CHARTS.map((chart) => chart.key);
    // Normalize to the catalog order so the charts display in a stable order
    const newSelectedKeys =
      selection === "all"
        ? catalogKeys
        : catalogKeys.filter((key) => selection.has(key));
    setMetricChartKeys(
      view,
      newSelectedKeys.slice(0, MAX_SELECTED_METRIC_CHARTS)
    );
  };

  return (
    <>
      <Autocomplete filter={contains}>
        <MenuHeader>
          <SearchField aria-label="Search charts" variant="quiet" autoFocus>
            <SearchIcon />
            <Input placeholder="Search charts" />
          </SearchField>
        </MenuHeader>
        <Menu
          aria-label="Metric charts"
          selectionMode="multiple"
          selectedKeys={selectedChartKeys}
          disabledKeys={disabledKeys}
          onSelectionChange={onSelectionChange}
          renderEmptyState={() => (
            <CompactEmptyState
              icon={<Icon svg={<Icons.BarChart />} />}
              description="No charts found"
            />
          )}
        >
          {selectedCharts.length > 0 && (
            <>
              <MenuSection>
                <MenuSectionTitle title="Selected" />
                {selectedCharts.map((chart) => (
                  <ChartMenuItem key={chart.key} chart={chart} />
                ))}
              </MenuSection>
              <Separator />
              <MenuSection>
                <MenuSectionTitle title="Available" />
                {unselectedCharts.map((chart) => (
                  <ChartMenuItem key={chart.key} chart={chart} />
                ))}
              </MenuSection>
            </>
          )}
          {selectedCharts.length === 0 &&
            unselectedCharts.map((chart) => (
              <ChartMenuItem key={chart.key} chart={chart} />
            ))}
        </Menu>
      </Autocomplete>
      <MenuFooter>
        <Flex direction="row" justifyContent="end">
          <Text size="XS" color="text-700">
            Show up to {MAX_SELECTED_METRIC_CHARTS} charts
          </Text>
        </Flex>
      </MenuFooter>
    </>
  );
}
