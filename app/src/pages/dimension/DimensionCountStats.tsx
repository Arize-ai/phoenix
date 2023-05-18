import React from "react";
import { graphql, useFragment } from "react-relay";
import { format } from "d3-format";

import { Text } from "@arizeai/components";

import { DimensionCountStats_dimension$key } from "./__generated__/DimensionCountStats_dimension.graphql";

const formatter = format("d");

export function DimensionCountStats(props: {
  dimension: DimensionCountStats_dimension$key;
}) {
  const data = useFragment<DimensionCountStats_dimension$key>(
    graphql`
      fragment DimensionCountStats_dimension on Dimension
      @argumentDefinitions(timeRange: { type: "TimeRange!" }) {
        id
        count: dataQualityMetric(metric: count, timeRange: $timeRange)
      }
    `,
    props.dimension
  );

  const count = data.count ?? 0;

  return (
    <>
      <Text elementType="h3" textSize="small" color="white70">
        Total
      </Text>
      <Text textSize="xlarge">{formatter(count)}</Text>
    </>
  );
}
