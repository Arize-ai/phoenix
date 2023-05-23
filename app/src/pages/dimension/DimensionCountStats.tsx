import React from "react";
import { graphql, useFragment } from "react-relay";

import { Text } from "@arizeai/components";

import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import { DimensionCountStats_dimension$key } from "./__generated__/DimensionCountStats_dimension.graphql";

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
        Total Count
      </Text>
      <Text textSize="xlarge">{intFormatter(count)}</Text>
    </>
  );
}
