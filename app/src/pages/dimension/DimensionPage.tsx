import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useLoaderData, useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Dialog, DialogContainer } from "@arizeai/components";

import { Flex, Loading, View, ViewSummaryAside } from "@phoenix/components";
import { useInferences, useTimeRange } from "@phoenix/contexts";
import { TimeSliceContextProvider } from "@phoenix/contexts/TimeSliceContext";
import { dimensionLoader } from "@phoenix/pages/dimension/dimensionLoader";

import { DimensionPageQuery } from "./__generated__/DimensionPageQuery.graphql";
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

export function DimensionPage() {
  const { dimensionId } = useParams();
  const { timeRange } = useTimeRange();
  const loaderData = useLoaderData<typeof dimensionLoader>();
  invariant(loaderData, "loaderData is required");
  const { referenceInferences } = useInferences();
  const hasReference = referenceInferences !== null;
  const showDrift = hasReference;
  // Only show cardinality if if the shape is non-continuous
  const showCardinality = loaderData.dimension.shape !== "continuous";
  const showQuantiles = loaderData.dimension.dataType === "numeric";
  const navigate = useNavigate();

  const data = useLazyLoadQuery<DimensionPageQuery>(
    graphql`
      query DimensionPageQuery(
        $dimensionId: ID!
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
        onDismiss={() => navigate(-1)}
      >
        <Dialog size="L" title={loaderData.dimension.name}>
          <main
            css={css`
              padding: var(--ac-global-dimension-static-size-100);
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
