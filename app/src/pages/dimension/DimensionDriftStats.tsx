import React from "react";
import { graphql, useFragment } from "react-relay";
import { format } from "d3-format";

import { Text } from "@arizeai/components";

const formatter = format(".2");

export function DimensionDriftStats(props: { dimension: any }) {
  const data = useFragment(
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
        Drift
      </Text>
      <Text>{formatter(data.psi)}</Text>
    </>
  );
}
