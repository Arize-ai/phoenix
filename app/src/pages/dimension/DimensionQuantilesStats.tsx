import React from "react";
import { graphql, useFragment } from "react-relay";
import { css } from "@emotion/react";

import { Text } from "@arizeai/components";

import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { DimensionQuantilesStats_dimension$key } from "./__generated__/DimensionQuantilesStats_dimension.graphql";

function formatValue(value: number | null) {
  return typeof value === "number" ? formatFloat(value) : "--";
}

export function DimensionQuantilesStats(props: {
  dimension: DimensionQuantilesStats_dimension$key;
}) {
  const data = useFragment<DimensionQuantilesStats_dimension$key>(
    graphql`
      fragment DimensionQuantilesStats_dimension on Dimension
      @argumentDefinitions(timeRange: { type: "TimeRange!" }) {
        p99: dataQualityMetric(metric: p99, timeRange: $timeRange)
        p75: dataQualityMetric(metric: p75, timeRange: $timeRange)
        p50: dataQualityMetric(metric: p50, timeRange: $timeRange)
        p25: dataQualityMetric(metric: p25, timeRange: $timeRange)
        p1: dataQualityMetric(metric: p01, timeRange: $timeRange)
      }
    `,
    props.dimension
  );

  return (
    <ul>
      {Object.keys(data).map((statName) => {
        const stat = data[statName as keyof typeof data];
        return (
          <li
            key={statName}
            css={css`
              display: flex;
              flex-direction: column;
              align-items: flex-end;
            `}
          >
            <Text elementType="h3" textSize="small" color="white70">
              {statName}
            </Text>
            <Text textSize="large" data-raw={stat}>
              {formatValue(stat as number | null)}
            </Text>
          </li>
        );
      })}
    </ul>
  );
}
