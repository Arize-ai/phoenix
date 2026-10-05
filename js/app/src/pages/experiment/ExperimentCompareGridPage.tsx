import { css } from "@emotion/react";
import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import { useParams } from "react-router";
import invariant from "tiny-invariant";

import { Loading } from "@phoenix/components";
import type { ExperimentComparePageQueriesCompareGridQuery as ExperimentComparePageQueriesCompareGridQueryType } from "@phoenix/pages/experiment/__generated__/ExperimentComparePageQueriesCompareGridQuery.graphql";

import { ExperimentCompareChartsPanelGroup } from "./ExperimentCompareMetricsCharts";
import { ExperimentCompareTable } from "./ExperimentCompareTable";
import { ExperimentRunFilterConditionProvider } from "./ExperimentRunFilterConditionContext";
import { useExperimentCompareSelection } from "./useExperimentCompareSelection";

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
  const selection = useExperimentCompareSelection();
  invariant(selection != null, "an experiment selection is required");

  return (
    <div css={gridPageCSS}>
      <ExperimentCompareChartsPanelGroup
        datasetId={datasetId}
        selection={selection}
      >
        <ExperimentRunFilterConditionProvider>
          <Suspense fallback={<Loading />}>
            <ExperimentCompareTable
              queryRef={queryRef}
              datasetId={datasetId}
              selection={selection}
            />
          </Suspense>
        </ExperimentRunFilterConditionProvider>
      </ExperimentCompareChartsPanelGroup>
    </div>
  );
}
