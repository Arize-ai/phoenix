import {
  Button,
  Flex,
  Icon,
  Icons,
  MenuContainer,
  MenuTrigger,
} from "@phoenix/components";
import { MetricsChartSelector } from "@phoenix/components/chart";
import { useProjectContext } from "@phoenix/contexts/ProjectContext";

import type { MetricChartTableView } from "./constants";
import { MAX_SELECTED_METRIC_CHARTS } from "./constants";
import { PROJECT_METRIC_CHARTS } from "./metrics/chartCatalog";

/**
 * The store-connected chart selector shown above a project table. Reads and
 * writes the per-view chart selection from the project store, and feeds the
 * project metric chart catalog into the generic {@link MetricsChartSelector}.
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
        <ConnectedChartSelectorMenu view={view} />
      </MenuContainer>
    </MenuTrigger>
  );
}

function ConnectedChartSelectorMenu({ view }: { view: MetricChartTableView }) {
  const selectedChartKeys = useProjectContext(
    (state) => state.metricChartKeys[view]
  );
  const setMetricChartKeys = useProjectContext(
    (state) => state.setMetricChartKeys
  );
  return (
    <MetricsChartSelector
      options={PROJECT_METRIC_CHARTS}
      selectedKeys={selectedChartKeys}
      maxSelected={MAX_SELECTED_METRIC_CHARTS}
      onSelectionChange={(keys) => setMetricChartKeys(view, keys)}
    />
  );
}
