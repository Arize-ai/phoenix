import React, { Suspense } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";
import { Cell, Pie, PieChart, Tooltip } from "recharts";

import { Flex, Text } from "@arizeai/components";

import { useChartColors } from "@phoenix/components/chart";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { EvaluationSummaryQuery } from "./__generated__/EvaluationSummaryQuery.graphql";
import {
  EvaluationSummaryValueFragment$data,
  EvaluationSummaryValueFragment$key,
} from "./__generated__/EvaluationSummaryValueFragment.graphql";

type EvaluationSummaryProps = {
  evaluationName: string;
};
export function EvaluationSummary({ evaluationName }: EvaluationSummaryProps) {
  const data = useLazyLoadQuery<EvaluationSummaryQuery>(
    graphql`
      query EvaluationSummaryQuery($evaluationName: String!) {
        ...EvaluationSummaryValueFragment
          @arguments(evaluationName: $evaluationName)
      }
    `,
    {
      evaluationName,
    }
  );
  return (
    <Flex direction="column">
      <Text elementType="h3" textSize="medium" color="text-700">
        {evaluationName}
      </Text>
      <Suspense fallback={<Text textSize="xlarge">--</Text>}>
        <EvaluationSummaryValue evaluationName={evaluationName} query={data} />
      </Suspense>
    </Flex>
  );
}

function EvaluationSummaryValue(props: { evaluationName: string; query: any }) {
  const { query } = props;
  const [data] = useRefetchableFragment<
    EvaluationSummaryQuery,
    EvaluationSummaryValueFragment$key
  >(
    graphql`
      fragment EvaluationSummaryValueFragment on Query
      @refetchable(queryName: "EvaluationSummaryValueQuery")
      @argumentDefinitions(evaluationName: { type: "String!" }) {
        spanEvaluationSummary(evaluationName: $evaluationName) {
          labelFractions {
            label
            fraction
          }
          meanScore
        }
      }
    `,
    query
  );

  const chartColors = useChartColors();
  const colors = [
    chartColors.default,
    chartColors.gray600,
    chartColors.gray400,
    chartColors.gray200,
  ];
  const meanScore = data?.spanEvaluationSummary?.meanScore;
  const labelFractions = data?.spanEvaluationSummary?.labelFractions;
  const hasMeanScore = typeof meanScore === "number";
  const hasLabelFractions =
    Array.isArray(labelFractions) && labelFractions.length > 0;

  return (
    <Flex direction="row" alignItems="center" gap="size-50">
      {hasLabelFractions ? (
        <PieChart width={24} height={24}>
          <Pie
            data={labelFractions}
            dataKey="fraction"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={8}
            outerRadius={11}
            strokeWidth={0}
            stroke="transparent"
          >
            {labelFractions.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colors[index % colors.length]}
              />
            ))}
            <Tooltip />
          </Pie>
        </PieChart>
      ) : null}
      <Text textSize="xlarge">
        {hasMeanScore ? formatFloat(meanScore) : null}
      </Text>
    </Flex>
  );
}
