import { graphql, useFragment } from "react-relay";

import { Text } from "@phoenix/components";
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
          inferencesRole: reference
        ) @include(if: $hasReference)
      }
    `,
    props.dimension
  );

  return (
    <>
      <Text elementType="h3" size="XS" color="text-700">
        % Empty
      </Text>
      <Text size="L">{percentFormatter(data.percentEmpty)}</Text>
      {data.referencePercentEmpty != null && (
        <Text size="M" color="purple-800">
          {percentFormatter(data.referencePercentEmpty)}
        </Text>
      )}
    </>
  );
}
