import React from "react";
import { useLoaderData, useNavigate, useParams } from "react-router";
import { css } from "@emotion/react";

import { Dialog, DialogContainer, View } from "@arizeai/components";

import { useTimeRange } from "@phoenix/contexts";
import { TimeSliceContextProvider } from "@phoenix/contexts/TimeSliceContext";

import { dimensionLoaderQuery$data } from "./__generated__/dimensionLoaderQuery.graphql";
import { DimensionDriftTimeSeries } from "./DimensionDriftTimeseries";

export function Dimension() {
  const { dimensionId } = useParams();
  const { timeRange } = useTimeRange();
  const data = useLoaderData() as dimensionLoaderQuery$data;
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
            `}
          >
            <View borderColor="dark" borderRadius="medium" height={200}>
              <DimensionDriftTimeSeries dimensionId={dimensionId} />
            </View>
          </main>
        </Dialog>
      </DialogContainer>
    </TimeSliceContextProvider>
  );
}
