import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Group, Panel } from "react-resizable-panels";
import { Outlet, useParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Button,
  ErrorBoundary,
  Flex,
  Heading,
  Text,
  View,
} from "@phoenix/components";
import {
  METRIC_CHARTS_CONTENT_PANEL_ID,
  MetricChartsPanel,
  useMetricChartsLayout,
} from "@phoenix/components/chart";

import type { ExperimentsPageQuery } from "./__generated__/ExperimentsPageQuery.graphql";
import { ExperimentsEmpty } from "./ExperimentsEmpty";
import {
  ExperimentsMetricsCharts,
  useAreExperimentsMetricChartsShown,
} from "./ExperimentsMetricsCharts";
import { ExperimentsTable } from "./ExperimentsTable";

export function ExperimentsPage() {
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required to view experiments");
  // We use a lazyLoadQuery here due to the fact that there is an issue with Relay connections
  // @see https://github.com/facebook/relay/issues/4875#issuecomment-3138533719
  const data = useLazyLoadQuery<ExperimentsPageQuery>(
    graphql`
      query ExperimentsPageQuery($datasetId: ID!) {
        dataset: node(id: $datasetId) {
          id
          ... on Dataset {
            experimentCount
          }
          ...ExperimentsTableFragment
        }
      }
    `,
    {
      datasetId,
    },
    { fetchPolicy: "store-and-network" }
  );
  const areChartsShown = useAreExperimentsMetricChartsShown();
  const chartsLayout = useMetricChartsLayout({
    id: "experiments-table-metrics-layout",
    isChartsPanelShown: areChartsShown,
  });

  if (!data.dataset?.experimentCount) {
    return <ExperimentsEmpty />;
  }

  return (
    <>
      <Group orientation="vertical" {...chartsLayout}>
        {areChartsShown && (
          <MetricChartsPanel>
            <ExperimentsMetricsCharts />
          </MetricChartsPanel>
        )}
        <Panel id={METRIC_CHARTS_CONTENT_PANEL_ID}>
          <View height="100%" overflow="hidden" flex="1 1 auto">
            <ErrorBoundary fallback={ErrorBoundaryFallback}>
              <ExperimentsTable dataset={data.dataset} />
            </ErrorBoundary>
          </View>
        </Panel>
      </Group>
      <Suspense>
        <Outlet />
      </Suspense>
    </>
  );
}
/**
 * Account for the issue in relay
 * @see https://github.com/facebook/relay/issues/4875
 */
function ErrorBoundaryFallback() {
  return (
    <View width="100%" height="100%">
      <Flex
        width="100%"
        height="100%"
        alignItems="center"
        justifyContent="center"
        direction="column"
      >
        <View width="400px">
          <Heading>Sorry about that!</Heading>
          <Text>
            There&apos;s a known issue in one of our dependencies that causes
            intermittent errors. We will resolve it as soon as there is an
            upstream fix.
            <br />
            <br />
            <Button variant="primary" onClick={() => window.location.reload()}>
              Refresh the page
            </Button>
          </Text>
        </View>
      </Flex>
    </View>
  );
}
