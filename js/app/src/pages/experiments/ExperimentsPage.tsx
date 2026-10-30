import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Group, Panel } from "react-resizable-panels";
import { Outlet, useParams, useSearchParams } from "react-router";
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
  ChartPanelStripSkeleton,
  METRIC_CHARTS_CONTENT_PANEL_ID,
  MetricChartsPanel,
  useMetricChartsLayout,
} from "@phoenix/components/chart";
import { TableSkeleton } from "@phoenix/components/table";

import type { ExperimentsPageQuery } from "./__generated__/ExperimentsPageQuery.graphql";
import { readMetadataFiltersFromSearchParams } from "./experimentMetadataFilters";
import { ExperimentsEmpty } from "./ExperimentsEmpty";
import {
  ExperimentsMetricsCharts,
  useAreExperimentsMetricChartsShown,
} from "./ExperimentsMetricsCharts";
import { ExperimentsTable } from "./ExperimentsTable";

export function ExperimentsPage() {
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required to view experiments");
  const [searchParams] = useSearchParams();
  // Read the URL's filters once. The table refetches when they change, so
  // the page query must not refetch, and suspend, as well.
  const [initialMetadataFilters] = useState(() => {
    const filters = readMetadataFiltersFromSearchParams(searchParams);
    return filters.length ? filters : null;
  });
  // We use a lazyLoadQuery here due to the fact that there is an issue with Relay connections
  // @see https://github.com/facebook/relay/issues/4875#issuecomment-3138533719
  const data = useLazyLoadQuery<ExperimentsPageQuery>(
    graphql`
      query ExperimentsPageQuery(
        $datasetId: ID!
        $metadataFilters: [ExperimentMetadataFilter!]
      ) {
        dataset: node(id: $datasetId) {
          id
          ... on Dataset {
            experimentCount
          }
          ...ExperimentsTableFragment
            @arguments(metadataFilters: $metadataFilters)
        }
      }
    `,
    {
      datasetId,
      metadataFilters: initialMetadataFilters,
    },
    { fetchPolicy: "store-and-network" }
  );

  if (!data.dataset?.experimentCount) {
    return <ExperimentsEmpty />;
  }

  return (
    <>
      <ExperimentsMetricChartsPanelGroup>
        <ErrorBoundary fallback={ErrorBoundaryFallback}>
          <ExperimentsTable dataset={data.dataset} />
        </ErrorBoundary>
      </ExperimentsMetricChartsPanelGroup>
      <Suspense>
        <Outlet />
      </Suspense>
    </>
  );
}

/**
 * A loading placeholder for the experiments page: the metric charts strip,
 * when shown, above the table's toolbar and rows.
 */
export function ExperimentsPageSkeleton() {
  return (
    <ExperimentsMetricChartsPanelGroup isSkeleton>
      <TableSkeleton hasToolbar isSelectable rowCount="fill" />
    </ExperimentsMetricChartsPanelGroup>
  );
}

/**
 * Lays out the metric charts strip above the experiments table in a
 * vertically resizable panel group, the strip only while charts are shown.
 */
function ExperimentsMetricChartsPanelGroup({
  isSkeleton = false,
  children,
}: {
  /**
   * Show a skeleton of the charts in place of the charts, for a page that is
   * still loading.
   * @default false
   */
  isSkeleton?: boolean;
  children: ReactNode;
}) {
  const areChartsShown = useAreExperimentsMetricChartsShown();
  const chartsLayout = useMetricChartsLayout({
    id: "experiments-table-metrics-layout",
    isChartsPanelShown: areChartsShown,
  });
  return (
    <Group orientation="vertical" {...chartsLayout}>
      {areChartsShown && (
        <MetricChartsPanel>
          {isSkeleton ? (
            <ChartPanelStripSkeleton />
          ) : (
            <ExperimentsMetricsCharts />
          )}
        </MetricChartsPanel>
      )}
      <Panel id={METRIC_CHARTS_CONTENT_PANEL_ID}>
        <View height="100%" overflow="hidden" flex="1 1 auto">
          {children}
        </View>
      </Panel>
    </Group>
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
