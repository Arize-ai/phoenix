import React, { Suspense } from "react";
import { useLoaderData, useNavigate, useParams } from "react-router";
import { css } from "@emotion/react";

import { Dialog, DialogContainer, View } from "@arizeai/components";

import { Loading } from "@phoenix/components";
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
                <View borderColor="dark" borderRadius="medium" height={200}>
                  <DimensionDriftTimeSeries dimensionId={dimensionId} />
                </View>
              ) : null}
              {showCardinality ? (
                <View borderColor="dark" borderRadius="medium" height={200}>
                  <DimensionCardinalityTimeSeries dimensionId={dimensionId} />
                </View>
              ) : null}
              <View borderColor="dark" borderRadius="medium" height={200}>
                <DimensionPercentEmptyTimeSeries dimensionId={dimensionId} />
              </View>
            </Suspense>
          </main>
        </Dialog>
      </DialogContainer>
    </TimeSliceContextProvider>
  );
}
