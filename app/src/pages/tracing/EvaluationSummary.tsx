import React, { startTransition, Suspense, useEffect } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";
import { Cell, Pie, PieChart } from "recharts";

import {
  Flex,
  HelpTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@arizeai/components";

import {
  ChartTooltipDivider,
  ChartTooltipItem,
  useChartColors,
} from "@phoenix/components/chart";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { formatFloat, formatPercent } from "@phoenix/utils/numberFormatUtils";

import { EvaluationSummaryQuery } from "./__generated__/EvaluationSummaryQuery.graphql";
import { EvaluationSummaryValueFragment$key } from "./__generated__/EvaluationSummaryValueFragment.graphql";

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

function EvaluationSummaryValue(props: {
  evaluationName: string;
  query: EvaluationSummaryValueFragment$key;
}) {
  const { query } = props;
  const { fetchKey } = useStreamState();
  const [data, refetch] = useRefetchableFragment<
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

  // Refetch the evaluation summary if the fetchKey changes
  useEffect(() => {
    startTransition(() => {
      refetch({}, { fetchPolicy: "store-and-network" });
    });
  }, [fetchKey, refetch]);

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
    <TooltipTrigger delay={0} placement="bottom">
      <TriggerWrap>
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
              </Pie>
            </PieChart>
          ) : null}
          <Text textSize="xlarge">
            {hasMeanScore ? formatFloat(meanScore) : "--"}
          </Text>
        </Flex>
      </TriggerWrap>
      <HelpTooltip>
        <View width="size-2400">
          <Flex direction="column" gap="size-50">
            {hasLabelFractions && (
              <ul>
                {labelFractions.map((entry, index) => (
                  <li key={entry.label}>
                    <ChartTooltipItem
                      color={colors[index % colors.length]}
                      name={entry.label}
                      shape="square"
                      value={formatPercent(entry.fraction * 100)}
                    />
                  </li>
                ))}
              </ul>
            )}
            {hasLabelFractions && hasMeanScore ? <ChartTooltipDivider /> : null}
            {hasMeanScore ? (
              <Flex direction="row" justifyContent="space-between">
                <Text>mean</Text>
                <Text>{formatFloat(meanScore)}</Text>
              </Flex>
            ) : null}
          </Flex>
        </View>
      </HelpTooltip>
    </TooltipTrigger>
  );
}
