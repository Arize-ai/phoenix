import React, { Suspense } from "react";
import { useLoaderData, useNavigate, useParams } from "react-router";
import { css } from "@emotion/react";

import { Dialog, DialogContainer, Flex, Text, View } from "@arizeai/components";

import { Loading, ViewAside } from "@phoenix/components";
import { useDatasets, useTimeRange } from "@phoenix/contexts";
import { TimeSliceContextProvider } from "@phoenix/contexts/TimeSliceContext";

import { dimensionLoaderQuery$data } from "./__generated__/dimensionLoaderQuery.graphql";
import { DimensionCardinalityTimeSeries } from "./DimensionCardinalityTimeSeries";
import { DimensionDriftTimeSeries } from "./DimensionDriftTimeSeries";
import { DimensionPercentEmptyTimeSeries } from "./DimensionPercentEmptyTimeSeries";

export function Dimension() {
  const { dimensionId } = useParams();
  const { timeRange } = useTimeRange();
  const data = useLoaderData() as dimensionLoaderQuery$data;
  const { referenceDataset } = useDatasets();
  const showDrift = referenceDataset !== null;
  // Only show cardinality if if the shape is non-continuous
  const showCardinality = data.dimension.shape !== "continuous";
  const navigate = useNavigate();

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
        <Dialog size="L" title={data.dimension.name}>
          <main
            css={css`
              padding: var(--px-spacing-med);
              display: flex;
              flex-direction: column;
              gap: var(--px-spacing-med);
              min-height: 400px;
              overflow-y: auto;
            `}
          >
            <Suspense fallback={<Loading />}>
              {showDrift ? (
                <View
                  borderColor="dark"
                  borderRadius="medium"
                  borderWidth="thin"
                  height={200}
                >
                  <Flex direction="row" alignItems="stretch" height="100%">
                    <DimensionDriftTimeSeries dimensionId={dimensionId} />
                    <ViewAside>
                      <h3>Drift</h3>
                      <Text color="white90">123</Text>
                    </ViewAside>
                  </Flex>
                </View>
              ) : null}
              {showCardinality ? (
                <View
                  borderColor="dark"
                  borderRadius="medium"
                  borderWidth="thin"
                  height={200}
                >
                  <Flex direction="row" alignItems="stretch" height="100%">
                    <DimensionCardinalityTimeSeries dimensionId={dimensionId} />
                    <ViewAside>
                      <h3>Cardinality</h3>
                      <Text color="white90">123</Text>
                    </ViewAside>
                  </Flex>
                </View>
              ) : null}
              <View
                borderColor="dark"
                borderRadius="medium"
                borderWidth="thin"
                height={200}
              >
                <Flex direction="row" alignItems="stretch" height="100%">
                  <DimensionPercentEmptyTimeSeries dimensionId={dimensionId} />
                  <ViewAside>
                    <h3>Percent Empty</h3>
                    <Text color="white90">123</Text>
                  </ViewAside>
                </Flex>
              </View>
            </Suspense>
          </main>
        </Dialog>
      </DialogContainer>
    </TimeSliceContextProvider>
  );
}
