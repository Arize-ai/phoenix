import React, { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useLoaderData, useNavigate, useParams } from "react-router";
import { css } from "@emotion/react";

import { Dialog, DialogContainer, Flex, View } from "@arizeai/components";

import { Loading, ViewSummaryAside } from "@phoenix/components";
import { useDatasets, useTimeRange } from "@phoenix/contexts";
import { TimeSliceContextProvider } from "@phoenix/contexts/TimeSliceContext";

import { dimensionLoaderQuery$data } from "./__generated__/dimensionLoaderQuery.graphql";
import { DimensionQuery } from "./__generated__/DimensionQuery.graphql";
import { DimensionCardinalityStats } from "./DimensionCardinalityStats";
import { DimensionCardinalityTimeSeries } from "./DimensionCardinalityTimeSeries";
import { DimensionCountStats } from "./DimensionCountStats";
import { DimensionCountTimeSeries } from "./DimensionCountTimeSeries";
import { DimensionDriftBreakdownSegmentBarChart } from "./DimensionDriftBreakdownSegmentBarChart";
import { DimensionDriftStats } from "./DimensionDriftStats";
import { DimensionDriftTimeSeries } from "./DimensionDriftTimeSeries";
import { DimensionPercentEmptyStats } from "./DimensionPercentEmptyStats";
import { DimensionPercentEmptyTimeSeries } from "./DimensionPercentEmptyTimeSeries";
import { DimensionQuantilesStats } from "./DimensionQuantilesStats";
import { DimensionQuantilesTimeSeries } from "./DimensionQuantilesTimeSeries";
import { DimensionSegmentsBarChart } from "./DimensionSegmentsBarChart";

export function Dimension() {
  const { dimensionId } = useParams();
  const { timeRange } = useTimeRange();
  const loaderData = useLoaderData() as dimensionLoaderQuery$data;
  const { referenceDataset } = useDatasets();
  const hasReference = referenceDataset !== null;
  const showDrift = hasReference;
  // Only show cardinality if if the shape is non-continuous
  const showCardinality = loaderData.dimension.shape !== "continuous";
  const showQuantiles = loaderData.dimension.dataType === "numeric";
  const navigate = useNavigate();

  const data = useLazyLoadQuery<DimensionQuery>(
    graphql`
      query DimensionQuery(
        $dimensionId: GlobalID!
        $timeRange: TimeRange!
        $hasReference: Boolean!
      ) {
        dimension: node(id: $dimensionId) {
          ... on Dimension {
            id
            ...DimensionSegmentsBarChart_dimension
              @arguments(timeRange: $timeRange)
            ...DimensionCountStats_dimension @arguments(timeRange: $timeRange)
            ...DimensionDriftStats_dimension @arguments(timeRange: $timeRange)
            ...DimensionCardinalityStats_dimension
              @arguments(timeRange: $timeRange, hasReference: $hasReference)
            ...DimensionPercentEmptyStats_dimension
              @arguments(timeRange: $timeRange, hasReference: $hasReference)
            ...DimensionQuantilesStats_dimension
              @arguments(timeRange: $timeRange)
          }
        }
      }
    `,
    {
      dimensionId: dimensionId!,
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
      hasReference,
    }
  );

  if (!dimensionId) {
    throw new Error("Dimension ID is required to display a dimension");
  }

  return (
    <TimeSliceContextProvider initialTimestamp={new Date(timeRange.end)}>
      <DialogContainer
        type="slideOver"
        isDismissable
        onDismiss={() => navigate("/")}
      >
        <Dialog size="L" title={loaderData.dimension.name}>
          <main
            css={css`
              padding: var(--px-spacing-med);
              display: flex;
              flex-direction: column;
              min-height: 400px;
              overflow-y: auto;
              height: 100%;
            `}
          >
            <Suspense fallback={<Loading />}>
              <Flex direction="column" gap="size-100">
                <View
                  borderColor="dark"
                  borderRadius="medium"
                  borderWidth="thin"
                  height="size-1600"
                >
                  <DimensionSegmentsBarChart dimension={data.dimension} />
                </View>
                <View
                  borderColor="dark"
                  borderRadius="medium"
                  borderWidth="thin"
                  height="size-1600"
                  data-testid="dimension-count-time-series-view"
                >
                  <Flex direction="row" alignItems="stretch" height="100%">
                    <DimensionCountTimeSeries dimensionId={dimensionId} />
                    <ViewSummaryAside>
                      <DimensionCountStats dimension={data.dimension} />
                    </ViewSummaryAside>
                  </Flex>
                </View>

                {showDrift ? (
                  <View
                    borderColor="dark"
                    borderRadius="medium"
                    borderWidth="thin"
                  >
                    <Flex direction="column" alignItems="stretch">
                      <View width="100%" height="size-1600">
                        <Flex
                          direction="row"
                          alignItems="stretch"
                          height="100%"
                        >
                          <View flex>
                            <DimensionDriftTimeSeries
                              dimensionId={dimensionId}
                            />
                          </View>
                          <ViewSummaryAside>
                            <DimensionDriftStats dimension={data.dimension} />
                          </ViewSummaryAside>
                        </Flex>
                      </View>
                      <View
                        height="size-1600"
                        width="100%"
                        borderTopColor="dark"
                        borderTopWidth="thin"
                      >
                        <Suspense fallback={<Loading />}>
                          <DimensionDriftBreakdownSegmentBarChart
                            dimensionId={dimensionId}
                          />
                        </Suspense>
                      </View>
                    </Flex>
                  </View>
                ) : null}
                {showQuantiles ? (
                  <View
                    borderColor="dark"
                    borderRadius="medium"
                    borderWidth="thin"
                    height="size-3000"
                  >
                    <Flex direction="row" alignItems="stretch" height="100%">
                      <View flex>
                        <DimensionQuantilesTimeSeries
                          dimensionId={dimensionId}
                        />
                      </View>
                      <ViewSummaryAside>
                        <DimensionQuantilesStats dimension={data.dimension} />
                      </ViewSummaryAside>
                    </Flex>
                  </View>
                ) : null}
                {showCardinality ? (
                  <View
                    borderColor="dark"
                    borderRadius="medium"
                    borderWidth="thin"
                    height="size-1600"
                  >
                    <Flex direction="row" alignItems="stretch" height="100%">
                      <View flex>
                        <DimensionCardinalityTimeSeries
                          dimensionId={dimensionId}
                        />
                      </View>
                      <ViewSummaryAside>
                        <DimensionCardinalityStats dimension={data.dimension} />
                      </ViewSummaryAside>
                    </Flex>
                  </View>
                ) : null}
                <View
                  borderColor="dark"
                  borderRadius="medium"
                  borderWidth="thin"
                  height="size-1600"
                >
                  <Flex direction="row" alignItems="stretch" height="100%">
                    <DimensionPercentEmptyTimeSeries
                      dimensionId={dimensionId}
                    />
                    <ViewSummaryAside>
                      <DimensionPercentEmptyStats dimension={data.dimension} />
                    </ViewSummaryAside>
                  </Flex>
                </View>
              </Flex>
            </Suspense>
          </main>
        </Dialog>
      </DialogContainer>
    </TimeSliceContextProvider>
  );
}
