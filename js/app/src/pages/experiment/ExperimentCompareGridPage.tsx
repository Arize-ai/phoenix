import { css } from "@emotion/react";
import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import { Group, Panel } from "react-resizable-panels";
import { useParams } from "react-router";
import invariant from "tiny-invariant";

import { Loading } from "@phoenix/components";
import {
  METRIC_CHARTS_CONTENT_PANEL_ID,
  MetricChartsPanel,
  useMetricChartsLayout,
} from "@phoenix/components/chart";
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
  const areChartsShown = useAreCompareChartsShown(datasetId);
  const chartsLayout = useMetricChartsLayout({
    id: "experiment-compare-grid-metrics-layout",
    isChartsPanelShown: areChartsShown,
  });

  return (
    <div css={gridPageCSS}>
      <Group orientation="vertical" {...chartsLayout}>
        {areChartsShown && (
          <MetricChartsPanel>
            <ExperimentCompareGridCharts
              datasetId={datasetId}
              experimentSelection={experimentSelection}
            />
          </MetricChartsPanel>
        )}
        <Panel id={METRIC_CHARTS_CONTENT_PANEL_ID}>
          <ExperimentRunFilterConditionProvider>
            <Suspense fallback={<Loading />}>
              <ExperimentCompareTable
                queryRef={queryRef}
                datasetId={datasetId}
                experimentSelection={experimentSelection}
              />
            </Suspense>
          </ExperimentRunFilterConditionProvider>
        </Panel>
      </Group>
    </div>
  );
}
