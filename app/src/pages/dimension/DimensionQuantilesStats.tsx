import React from "react";
import { graphql, useFragment } from "react-relay";
import { css } from "@emotion/react";

import { Text } from "@arizeai/components";

import { numberFormatter } from "@phoenix/utils/numberFormatUtils";

import { DimensionQuantilesStats_dimension$key } from "./__generated__/DimensionQuantilesStats_dimension.graphql";

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
    <ul
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--px-spacing-sm);
      `}
    >
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
            <Text elementType="h3" textSize="xsmall" color="white70">
              {statName}
            </Text>
            <Text textSize="medium" data-raw={stat}>
              {numberFormatter(stat as number | null)}
            </Text>
          </li>
        );
      })}
    </ul>
  );
}
