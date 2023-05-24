import React from "react";
import { graphql, useFragment } from "react-relay";

import { Text } from "@arizeai/components";

import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import { DimensionCardinalityStats_dimension$key } from "./__generated__/DimensionCardinalityStats_dimension.graphql";

export function DimensionCardinalityStats(props: {
  dimension: DimensionCardinalityStats_dimension$key;
}) {
  const data = useFragment<DimensionCardinalityStats_dimension$key>(
    graphql`
      fragment DimensionCardinalityStats_dimension on Dimension
      @argumentDefinitions(
        timeRange: { type: "TimeRange!" }
        hasReference: { type: "Boolean!" }
      ) {
        id
        cardinality: dataQualityMetric(
          metric: cardinality
          timeRange: $timeRange
        )
        referenceCardinality: dataQualityMetric(
          metric: cardinality
          datasetRole: reference
        ) @include(if: $hasReference)
      }
    `,
    props.dimension
  );

  return (
    <>
      <Text elementType="h3" textSize="small" color="white70">
        Cardinality
      </Text>
      <Text textSize="xlarge">{intFormatter(data.cardinality)}</Text>
      {data.referenceCardinality != null && (
        <Text
          textSize="medium"
          color="white70"
          title="the reference cardinality"
          className="reference-text-color"
        >
          {intFormatter(data.referenceCardinality)}
        </Text>
      )}
    </>
  );
}
