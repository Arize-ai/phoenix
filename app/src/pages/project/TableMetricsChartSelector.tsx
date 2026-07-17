import { Suspense } from "react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Loading,
  MenuContainer,
  MenuTrigger,
} from "@phoenix/components";
import { MetricsChartSelector } from "@phoenix/components/chart";
import { useProjectContext } from "@phoenix/contexts/ProjectContext";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import type { MetricChartTableView, ProjectMetricChartKey } from "./constants";
import {
  getProjectEvaluationMetricChartInfo,
  getProjectEvaluationMetricChartKey,
  MAX_SELECTED_METRIC_CHARTS,
} from "./constants";
import { PROJECT_METRIC_CHARTS } from "./metrics/chartCatalog";
import {
  useSessionEvaluationMetricNames,
  useSpanEvaluationMetricNames,
  useTraceEvaluationMetricNames,
} from "./metrics/ProjectEvaluationMetricsGrids";
import { MetricFetchKeyProvider } from "./metrics/types";
import { useClosedTimeRange } from "./metrics/useClosedTimeRange";

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
  const projectId = useTracingContext((state) => state.projectId);
  const { fetchKey } = useStreamState();
  const timeRange = useClosedTimeRange({ refreshKey: fetchKey });
  const selectedChartKeys = useProjectContext(
    (state) => state.metricChartKeys[view]
  );
  const setMetricChartKeys = useProjectContext(
    (state) => state.setMetricChartKeys
  );
  return (
    <MetricFetchKeyProvider value={fetchKey}>
      <Suspense fallback={<Loading />}>
        <ProjectChartSelectorMenu
          view={view}
          projectId={projectId}
          timeRange={timeRange}
          selectedChartKeys={selectedChartKeys}
          onSelectionChange={(keys) => setMetricChartKeys(view, keys)}
        />
      </Suspense>
    </MetricFetchKeyProvider>
  );
}

type ProjectChartSelectorMenuProps = {
  view: MetricChartTableView;
  projectId: string;
  timeRange: TimeRange;
  selectedChartKeys: ProjectMetricChartKey[];
  onSelectionChange: (keys: ProjectMetricChartKey[]) => void;
};

function ProjectChartSelectorMenu(props: ProjectChartSelectorMenuProps) {
  switch (props.view) {
    case "spans":
      return <SpanChartSelectorMenu {...props} />;
    case "traces":
      return <TraceChartSelectorMenu {...props} />;
    case "sessions":
      return <SessionChartSelectorMenu {...props} />;
  }
}

function SpanChartSelectorMenu(props: ProjectChartSelectorMenuProps) {
  const evaluationNames = useSpanEvaluationMetricNames(props);
  return (
    <ProjectChartSelectorMenuContent
      {...props}
      evaluationNames={evaluationNames}
    />
  );
}

function TraceChartSelectorMenu(props: ProjectChartSelectorMenuProps) {
  const evaluationNames = useTraceEvaluationMetricNames(props);
  return (
    <ProjectChartSelectorMenuContent
      {...props}
      evaluationNames={evaluationNames}
    />
  );
}

function SessionChartSelectorMenu(props: ProjectChartSelectorMenuProps) {
  const evaluationNames = useSessionEvaluationMetricNames(props);
  return (
    <ProjectChartSelectorMenuContent
      {...props}
      evaluationNames={evaluationNames}
    />
  );
}

function ProjectChartSelectorMenuContent({
  view,
  evaluationNames,
  selectedChartKeys,
  onSelectionChange,
}: ProjectChartSelectorMenuProps & {
  evaluationNames: ReadonlyArray<string>;
}) {
  const availableEvaluationKeys = new Set<ProjectMetricChartKey>(
    evaluationNames.map((evaluationName) =>
      getProjectEvaluationMetricChartKey({ view, evaluationName })
    )
  );
  // Preserve a persisted evaluation if its annotation was deleted so the
  // user can still deselect the empty chart.
  const unavailableSelectedEvaluations = selectedChartKeys.flatMap((key) => {
    const evaluationInfo = getProjectEvaluationMetricChartInfo(key);
    return evaluationInfo == null || availableEvaluationKeys.has(key)
      ? []
      : [
          {
            key,
            name: evaluationInfo.evaluationName,
            description: "Evaluation results over time",
            chartType: "line" as const,
          },
        ];
  });
  const evaluationOptions = evaluationNames.map((evaluationName) => ({
    key: getProjectEvaluationMetricChartKey({
      view,
      evaluationName,
    }),
    name: evaluationName,
    description: "Evaluation results over time",
    // The lightweight catalog query intentionally omits full series data, so
    // use a neutral chart glyph until the selected chart reveals its view.
    chartType: "line" as const,
  }));
  return (
    <MetricsChartSelector
      options={[
        ...PROJECT_METRIC_CHARTS,
        ...evaluationOptions,
        ...unavailableSelectedEvaluations,
      ]}
      selectedKeys={selectedChartKeys}
      maxSelected={MAX_SELECTED_METRIC_CHARTS}
      onSelectionChange={onSelectionChange}
    />
  );
}
