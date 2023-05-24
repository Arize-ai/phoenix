import React from "react";
import { graphql, useFragment } from "react-relay";

import { Text } from "@arizeai/components";

import { percentFormatter } from "@phoenix/utils/numberFormatUtils";

import { DimensionPercentEmptyStats_dimension$key } from "./__generated__/DimensionPercentEmptyStats_dimension.graphql";

export function DimensionPercentEmptyStats(props: {
  dimension: DimensionPercentEmptyStats_dimension$key;
}) {
  const data = useFragment<DimensionPercentEmptyStats_dimension$key>(
    graphql`
      fragment DimensionPercentEmptyStats_dimension on Dimension
      @argumentDefinitions(
        timeRange: { type: "TimeRange!" }
        hasReference: { type: "Boolean!" }
      ) {
        id
        percentEmpty: dataQualityMetric(
          metric: percentEmpty
          timeRange: $timeRange
        )
        referencePercentEmpty: dataQualityMetric(
          metric: percentEmpty
          datasetRole: reference
        ) @include(if: $hasReference)
      }
    `,
    props.dimension
  );

  return (
    <>
      <Text elementType="h3" textSize="small" color="white70">
        % Empty
      </Text>
      <Text textSize="xlarge">{percentFormatter(data.percentEmpty)}</Text>
      {data.referencePercentEmpty != null && (
        <Text
          textSize="medium"
          color="white70"
          title="the reference percent empty"
          className="reference-text-color"
        >
          {percentFormatter(data.referencePercentEmpty)}
        </Text>
      )}
    </>
  );
}
