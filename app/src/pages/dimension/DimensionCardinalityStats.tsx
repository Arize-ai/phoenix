import React from "react";
import { graphql, useFragment } from "react-relay";
import { format } from "d3-format";

import { Text } from "@arizeai/components";

import { DimensionCardinalityStats_dimension$key } from "./__generated__/DimensionCardinalityStats_dimension.graphql";

const formatter = format("d");

export function DimensionCardinalityStats(props: {
  dimension: DimensionCardinalityStats_dimension$key;
}) {
  const data = useFragment<DimensionCardinalityStats_dimension$key>(
    graphql`
      fragment DimensionCardinalityStats_dimension on Dimension
      @argumentDefinitions(timeRange: { type: "TimeRange!" }) {
        id
        cardinality: dataQualityMetric(
          metric: cardinality
          timeRange: $timeRange
        )
      }
    `,
    props.dimension
  );

  return (
    <>
      <Text elementType="h3" textSize="small" color="white70">
        Cardinality
      </Text>
      <Text textSize="xlarge">
        {data.cardinality != null ? formatter(data.cardinality) : "--"}
      </Text>
    </>
  );
}
