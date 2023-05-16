import React from "react";
import { graphql, useFragment } from "react-relay";
import { format } from "d3-format";

import { Text } from "@arizeai/components";

import { DimensionPercentEmptyStats_dimension$key } from "./__generated__/DimensionPercentEmptyStats_dimension.graphql";

const formatter = format(".2f");

export function DimensionPercentEmptyStats(props: {
  dimension: DimensionPercentEmptyStats_dimension$key;
}) {
  const data = useFragment<DimensionPercentEmptyStats_dimension$key>(
    graphql`
      fragment DimensionPercentEmptyStats_dimension on Dimension
      @argumentDefinitions(timeRange: { type: "TimeRange!" }) {
        id
        percentEmpty: dataQualityMetric(
          metric: percentEmpty
          timeRange: $timeRange
        )
      }
    `,
    props.dimension
  );

  return (
    <>
      <Text elementType="h3" textSize="small" color="white70">
        % Empty
      </Text>
      <Text textSize="xlarge">
        {data.percentEmpty != null ? `${formatter(data.percentEmpty)}%` : "--"}
      </Text>
    </>
  );
}
