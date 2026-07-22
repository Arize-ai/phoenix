import {
  Button,
  Flex,
  Icon,
  Icons,
  MenuContainer,
  MenuTrigger,
} from "@phoenix/components";
import { MetricsChartSelector } from "@phoenix/components/chart";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import { MAX_SELECTED_EXPERIMENT_METRIC_CHARTS } from "@phoenix/pages/dataset/constants";
import { EXPERIMENT_METRIC_CHARTS } from "@phoenix/pages/dataset/metrics/chartCatalog";

/**
 * The store-connected chart selector shown above the experiments table. Reads
 * and writes the chart selection from the dataset store, and feeds the
 * experiment metric chart catalog into the generic
 * {@link MetricsChartSelector}.
 */
export function ExperimentsMetricsChartSelector() {
  return (
    <MenuTrigger>
      <Button aria-label="Select metric charts">
        <Flex direction="row" alignItems="center" gap="size-100">
          <Icon svg={<Icons.BarChart />} />
          Charts
        </Flex>
      </Button>
      <MenuContainer placement="bottom end">
        <ConnectedChartSelectorMenu />
      </MenuContainer>
    </MenuTrigger>
  );
}

function ConnectedChartSelectorMenu() {
  const selectedChartKeys = useDatasetContext(
    (state) => state.experimentsMetricChartKeys
  );
  const setExperimentsMetricChartKeys = useDatasetContext(
    (state) => state.setExperimentsMetricChartKeys
  );
  return (
    <MetricsChartSelector
      options={EXPERIMENT_METRIC_CHARTS}
      selectedKeys={selectedChartKeys}
      maxSelected={MAX_SELECTED_EXPERIMENT_METRIC_CHARTS}
      onSelectionChange={setExperimentsMetricChartKeys}
    />
  );
}
