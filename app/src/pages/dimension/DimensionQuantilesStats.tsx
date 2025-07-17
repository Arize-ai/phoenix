import { graphql, useFragment } from "react-relay";
import { css } from "@emotion/react";

import { Text } from "@phoenix/components";
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
        gap: var(--ac-global-dimension-static-size-50);
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
            <Text elementType="h3" size="XS" color="text-700">
              {statName}
            </Text>
            <Text size="S" data-raw={stat}>
              {numberFormatter(stat as number | null)}
            </Text>
          </li>
        );
      })}
    </ul>
  );
}
