import { graphql, useFragment } from "react-relay";

import { Text } from "@phoenix/components";
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
          inferencesRole: reference
        ) @include(if: $hasReference)
      }
    `,
    props.dimension
  );

  return (
    <>
      <Text elementType="h3" size="XS" color="text-700">
        Cardinality
      </Text>
      <Text>{intFormatter(data.cardinality)}</Text>
      {data.referenceCardinality != null && (
        <Text size="S" color="purple-800">
          {intFormatter(data.referenceCardinality)}
        </Text>
      )}
    </>
  );
}
