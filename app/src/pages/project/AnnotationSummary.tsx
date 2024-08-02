import React, { startTransition, Suspense, useEffect } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";
import { useParams } from "react-router";
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
import { useLastNTimeRange } from "@phoenix/components/datetime";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useWordColor } from "@phoenix/hooks/useWordColor";
import { formatFloat, formatPercent } from "@phoenix/utils/numberFormatUtils";

import { AnnotationSummaryQuery } from "./__generated__/AnnotationSummaryQuery.graphql";
import { AnnotationSummaryValueFragment$key } from "./__generated__/AnnotationSummaryValueFragment.graphql";

type AnnotationSummaryProps = {
  annotationName: string;
};
export function AnnotationSummary({ annotationName }: AnnotationSummaryProps) {
  const { projectId } = useParams();
  const { timeRange } = useLastNTimeRange();
  const data = useLazyLoadQuery<AnnotationSummaryQuery>(
    graphql`
      query AnnotationSummaryQuery(
        $id: GlobalID!
        $annotationName: String!
        $timeRange: TimeRange!
      ) {
        project: node(id: $id) {
          ...AnnotationSummaryValueFragment
            @arguments(annotationName: $annotationName, timeRange: $timeRange)
        }
      }
    `,
    {
      annotationName,
      id: projectId as string,
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      },
    }
  );
  return (
    <Flex direction="column" flex="none">
      <Text elementType="h3" textSize="medium" color="text-700">
        {annotationName}
      </Text>
      <Suspense fallback={<Text textSize="xlarge">--</Text>}>
        <AnnotationSummaryValue
          annotationName={annotationName}
          project={data.project}
        />
      </Suspense>
    </Flex>
  );
}

function AnnotationSummaryValue(props: {
  annotationName: string;
  project: AnnotationSummaryValueFragment$key;
}) {
  const { project, annotationName } = props;
  const { fetchKey } = useStreamState();
  const [data, refetch] = useRefetchableFragment<
    AnnotationSummaryQuery,
    AnnotationSummaryValueFragment$key
  >(
    graphql`
      fragment AnnotationSummaryValueFragment on Project
      @refetchable(queryName: "AnnotationSummaryValueQuery")
      @argumentDefinitions(
        annotationName: { type: "String!" }
        timeRange: { type: "TimeRange!" }
      ) {
        spanAnnotationSummary(
          annotationName: $annotationName
          timeRange: $timeRange
        ) {
          labelFractions {
            label
            fraction
          }
          meanScore
        }
      }
    `,
    project
  );

  // Refetch the annotation summary if the fetchKey changes
  useEffect(() => {
    startTransition(() => {
      refetch({}, { fetchPolicy: "store-and-network" });
    });
  }, [fetchKey, refetch]);

  const chartColors = useChartColors();
  const primaryColor = useWordColor(annotationName);
  const colors = [
    primaryColor,
    chartColors.default,
    chartColors.gray600,
    chartColors.gray400,
    chartColors.gray200,
  ];
  const meanScore = data?.spanAnnotationSummary?.meanScore;
  const labelFractions = data?.spanAnnotationSummary?.labelFractions;
  const hasMeanScore = typeof meanScore === "number";
  const hasLabelFractions =
    Array.isArray(labelFractions) && labelFractions.length > 0;
  if (!hasMeanScore && !hasLabelFractions) {
    return <Text textSize="xlarge">--</Text>;
  }

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
