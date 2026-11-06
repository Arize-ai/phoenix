import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import { Group, Panel } from "react-resizable-panels";
import { useParams } from "react-router";
import invariant from "tiny-invariant";

import {
  ChartPanelStripSkeleton,
  METRIC_CHARTS_CONTENT_PANEL_ID,
  MetricChartsPanel,
  useMetricChartsLayout,
} from "@phoenix/components/chart";
import { TableSkeleton } from "@phoenix/components/table";
import type { ExperimentComparePageQueriesCompareGridQuery as ExperimentComparePageQueriesCompareGridQueryType } from "@phoenix/pages/experiment/__generated__/ExperimentComparePageQueriesCompareGridQuery.graphql";

import {
  ExperimentCompareGridCharts,
  useAreCompareChartsShown,
} from "./ExperimentCompareMetricsCharts";
import { ExperimentCompareTable } from "./ExperimentCompareTable";
import { ExperimentRunFilterConditionProvider } from "./ExperimentRunFilterConditionContext";
import { useComparedExperimentSelection } from "./useComparedExperimentSelection";

const gridPageCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
`;

export function ExperimentCompareGridPage({
  queryRef,
}: {
  queryRef: PreloadedQuery<ExperimentComparePageQueriesCompareGridQueryType>;
}) {
  const { datasetId } = useParams();
  invariant(datasetId != null, "datasetId is required");
  const experimentSelection = useComparedExperimentSelection();
  invariant(experimentSelection != null, "an experiment selection is required");

  return (
    <ExperimentCompareGridPanelGroup
      charts={
        <ExperimentCompareGridCharts
          datasetId={datasetId}
          experimentSelection={experimentSelection}
        />
      }
    >
      <ExperimentRunFilterConditionProvider>
        <Suspense fallback={<ExperimentCompareTableSkeleton />}>
          <ExperimentCompareTable
            queryRef={queryRef}
            datasetId={datasetId}
            experimentSelection={experimentSelection}
          />
        </Suspense>
      </ExperimentRunFilterConditionProvider>
    </ExperimentCompareGridPanelGroup>
  );
}

/**
 * A loading placeholder for the compare grid page: the metric charts strip,
 * when shown, above the grid's toolbar and rows.
 */
export function ExperimentCompareGridPageSkeleton() {
  return (
    <ExperimentCompareGridPanelGroup charts={<ChartPanelStripSkeleton />}>
      <ExperimentCompareTableSkeleton />
    </ExperimentCompareGridPanelGroup>
  );
}

function ExperimentCompareTableSkeleton() {
  return <TableSkeleton hasToolbar rowCount="fill" />;
}

/**
 * Lays out the metric charts strip above the compare grid in a vertically
 * resizable panel group, the strip only while the dataset's charts are shown.
 */
function ExperimentCompareGridPanelGroup({
  charts,
  children,
}: {
  charts: ReactNode;
  children: ReactNode;
}) {
  const { datasetId } = useParams();
  invariant(datasetId != null, "datasetId is required");
  const areChartsShown = useAreCompareChartsShown(datasetId);
  const chartsLayout = useMetricChartsLayout({
    id: "experiment-compare-grid-metrics-layout",
    isChartsPanelShown: areChartsShown,
  });
  return (
    <div css={gridPageCSS}>
      <Group orientation="vertical" {...chartsLayout}>
        {areChartsShown && <MetricChartsPanel>{charts}</MetricChartsPanel>}
        <Panel id={METRIC_CHARTS_CONTENT_PANEL_ID}>{children}</Panel>
      </Group>
    </div>
  );
}
