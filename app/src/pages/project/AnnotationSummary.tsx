import React, { startTransition, Suspense, useEffect } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";
import { useParams } from "react-router";
import { Cell, Pie, PieChart } from "recharts";

import { HelpTooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import { Flex, Text, View } from "@phoenix/components";
import {
  ChartTooltipDivider,
  ChartTooltipItem,
  useChartColors,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/components/datetime";
import { ComponentSize, SizingProps } from "@phoenix/components/types";
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
  const { timeRange } = useTimeRange();
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
        start: timeRange?.start?.toISOString(),
        end: timeRange?.end?.toISOString(),
      },
    }
  );
  return (
    <Summary name={annotationName}>
      <AnnotationSummaryValue
        annotationName={annotationName}
        project={data.project}
      />
    </Summary>
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

  return (
    <SummaryValue
      name={annotationName}
      meanScore={data?.spanAnnotationSummary?.meanScore}
      labelFractions={data?.spanAnnotationSummary?.labelFractions}
    />
  );
}

export function Summary({
  children,
  name,
}: {
  children: React.ReactNode;
  name: string;
}) {
  return (
    <Flex direction="column" flex="none">
      <Text elementType="h3" size="S" color="text-700">
        {name}
      </Text>
      <Suspense fallback={<Text size="L">--</Text>}>{children}</Suspense>
    </Flex>
  );
}

const SizesMap: Record<
  ComponentSize,
  {
    chart: {
      width: number;
      height: number;
    };
    pie: {
      innerRadius: number;
      outerRadius: number;
    };
  }
> = {
  M: {
    chart: {
      width: 24,
      height: 24,
    },
    pie: {
      innerRadius: 8,
      outerRadius: 11,
    },
  },
  S: {
    chart: {
      width: 16,
      height: 16,
    },
    pie: {
      innerRadius: 6,
      outerRadius: 8,
    },
  },
  L: {
    chart: {
      width: 32,
      height: 32,
    },
    pie: {
      innerRadius: 10,
      outerRadius: 13,
    },
  },
};

export function SummaryValue({
  name,
  meanScore,
  labelFractions,
  size = "M",
}: {
  name: string;
  meanScore?: number | null;
  labelFractions?: readonly { label: string; fraction: number }[];
} & SizingProps) {
  const chartColors = useChartColors();
  const primaryColor = useWordColor(name);
  const colors = [
    primaryColor,
    chartColors.default,
    chartColors.gray600,
    chartColors.gray400,
    chartColors.gray200,
  ];
  const hasMeanScore = typeof meanScore === "number";
  const hasLabelFractions =
    Array.isArray(labelFractions) && labelFractions.length > 0;
  if (!hasMeanScore && !hasLabelFractions) {
    return <Text size="L">--</Text>;
  }
  const chartDimensions = SizesMap[size].chart;
  const pieDimensions = SizesMap[size].pie;

  return (
    <TooltipTrigger delay={0} placement="bottom">
      <TriggerWrap>
        <Flex direction="row" alignItems="center" gap="size-50">
          {hasLabelFractions ? (
            <PieChart {...chartDimensions}>
              <Pie
                data={labelFractions}
                dataKey="fraction"
                nameKey="label"
                cx="50%"
                cy="50%"
                {...pieDimensions}
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
          <Text size={size === "S" ? size : "L"}>
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
