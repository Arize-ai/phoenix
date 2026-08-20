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
import {
  ErrorBoundary,
  TextErrorBoundaryFallback,
} from "@phoenix/components/exception";
import { useProjectContext } from "@phoenix/contexts/ProjectContext";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import type { MetricChartTableView, ProjectMetricChartKey } from "./constants";
import {
  getProjectAnnotationMetricChartInfo,
  getProjectAnnotationMetricChartKey,
} from "./constants";
import {
  getProjectMetricCharts,
  PROJECT_METRIC_CHARTS,
} from "./metrics/chartCatalog";
import {
  useSessionAnnotationMetricNames,
  useSpanAnnotationMetricNames,
  useTraceAnnotationMetricNames,
} from "./metrics/ProjectAnnotationMetrics";
import { MetricFetchKeyProvider } from "./metrics/types";

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
  const selectedChartKeys = useProjectContext(
    (state) => state.metricChartKeys[view]
  );
  const setMetricChartKeys = useProjectContext(
    (state) => state.setMetricChartKeys
  );
  return (
    <MetricFetchKeyProvider value={fetchKey}>
      <ErrorBoundary fallback={TextErrorBoundaryFallback}>
        <Suspense fallback={<Loading />}>
          <ProjectChartSelectorMenu
            view={view}
            projectId={projectId}
            selectedChartKeys={selectedChartKeys}
            onSelectionChange={(keys) => setMetricChartKeys(view, keys)}
          />
        </Suspense>
      </ErrorBoundary>
    </MetricFetchKeyProvider>
  );
}

type ProjectChartSelectorMenuProps = {
  view: MetricChartTableView;
  projectId: string;
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
  return null;
}

function SpanChartSelectorMenu(props: ProjectChartSelectorMenuProps) {
  const annotationNames = useSpanAnnotationMetricNames(props.projectId);
  return (
    <ProjectChartSelectorMenuContent
      {...props}
      annotationNames={annotationNames}
    />
  );
}

function TraceChartSelectorMenu(props: ProjectChartSelectorMenuProps) {
  const annotationNames = useTraceAnnotationMetricNames(props.projectId);
  return (
    <ProjectChartSelectorMenuContent
      {...props}
      annotationNames={annotationNames}
    />
  );
}

function SessionChartSelectorMenu(props: ProjectChartSelectorMenuProps) {
  const annotationNames = useSessionAnnotationMetricNames(props.projectId);
  return (
    <ProjectChartSelectorMenuContent
      {...props}
      annotationNames={annotationNames}
    />
  );
}

function ProjectChartSelectorMenuContent({
  view,
  annotationNames,
  selectedChartKeys,
  onSelectionChange,
}: ProjectChartSelectorMenuProps & {
  annotationNames: ReadonlyArray<string>;
}) {
  const annotationKeys = annotationNames.map((annotationName) =>
    getProjectAnnotationMetricChartKey({ view, annotationName })
  );
  const availableAnnotationKeys = new Set<ProjectMetricChartKey>(
    annotationKeys
  );
  // Keep a persisted annotation visible if it was deleted so the user can
  // still deselect the empty chart.
  const unavailableSelectedAnnotationKeys = selectedChartKeys.filter(
    (key) =>
      getProjectAnnotationMetricChartInfo(key) != null &&
      !availableAnnotationKeys.has(key)
  );
  return (
    <MetricsChartSelector
      options={[
        ...PROJECT_METRIC_CHARTS,
        ...getProjectMetricCharts([
          ...annotationKeys,
          ...unavailableSelectedAnnotationKeys,
        ]),
      ]}
      selectedKeys={selectedChartKeys}
      onSelectionChange={onSelectionChange}
    />
  );
}
