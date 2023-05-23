import React from "react";
import { graphql, useFragment } from "react-relay";

import { Text } from "@arizeai/components";

import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import { DimensionDriftStats_dimension$key } from "./__generated__/DimensionDriftStats_dimension.graphql";

export function DimensionDriftStats(props: {
  dimension: DimensionDriftStats_dimension$key;
}) {
  const data = useFragment<DimensionDriftStats_dimension$key>(
    graphql`
      fragment DimensionDriftStats_dimension on Dimension
      @argumentDefinitions(timeRange: { type: "TimeRange!" }) {
        id
        psi: driftMetric(metric: psi, timeRange: $timeRange)
      }
    `,
    props.dimension
  );

  return (
    <>
      <Text elementType="h3" textSize="small" color="white70">
        PSI
      </Text>
      <Text textSize="xlarge">{floatFormatter(data.psi)}</Text>
    </>
  );
}
