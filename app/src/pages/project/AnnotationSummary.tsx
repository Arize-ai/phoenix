import React, { startTransition, Suspense, useEffect } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";
import { useParams } from "react-router";
import { Cell, Pie, PieChart } from "recharts";

import { HelpTooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import { Flex, Text, View } from "@phoenix/components";
import { MeanScore } from "@phoenix/components/annotation/MeanScore";
import {
  ChartTooltipDivider,
  ChartTooltipItem,
  useChartColors,
} from "@phoenix/components/chart";
import { useTimeRange } from "@phoenix/components/datetime";
import { ComponentSize, SizingProps } from "@phoenix/components/types";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useWordColor } from "@phoenix/hooks/useWordColor";
import { formatPercent } from "@phoenix/utils/numberFormatUtils";

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
        <Truncate maxWidth="120px">{name}</Truncate>
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

function useAnnotationSummaryChartColors(name: string) {
  const chartColors = useChartColors();
  const primaryColor = useWordColor(name);
  const colors = [
    primaryColor,
    chartColors.default,
    chartColors.gray600,
    chartColors.gray400,
    chartColors.gray200,
  ];
  return colors;
}

export function SummaryValue({
  name,
  meanScore,
  labelFractions,
  size = "M",
  disableAnimation = false,
  meanScoreFallback,
}: SummaryValuePreviewProps) {
  const hasMeanScore = typeof meanScore === "number";
  const hasLabelFractions =
    Array.isArray(labelFractions) && labelFractions.length > 0;
  if (!hasMeanScore && !hasLabelFractions) {
    return <Text size="L">--</Text>;
  }

  return (
    <TooltipTrigger delay={0} placement="bottom">
      <TriggerWrap>
        <SummaryValuePreview
          name={name}
          meanScore={meanScore}
          labelFractions={labelFractions}
          size={size}
          disableAnimation={disableAnimation}
          meanScoreFallback={meanScoreFallback}
        />
      </TriggerWrap>
      <HelpTooltip>
        <SummaryValueBreakdown
          annotationName={name}
          labelFractions={labelFractions}
          meanScore={meanScore}
        />
      </HelpTooltip>
    </TooltipTrigger>
  );
}

type SummaryValuePreviewProps = {
  name: string;
  meanScore?: number | null;
  labelFractions?: readonly { label: string; fraction: number }[];
  disableAnimation?: boolean;
  meanScoreFallback?: React.ReactNode;
} & SizingProps;

export function SummaryValuePreview({
  name,
  meanScore,
  labelFractions,
  size = "M",
  disableAnimation,
  meanScoreFallback,
}: SummaryValuePreviewProps) {
  const colors = useAnnotationSummaryChartColors(name);
  const hasMeanScore = typeof meanScore === "number";
  const hasLabelFractions =
    Array.isArray(labelFractions) && labelFractions.length > 0;
  if (!hasMeanScore && !hasLabelFractions) {
    return <Text size="L">--</Text>;
  }
  const chartDimensions = SizesMap[size].chart;
  const pieDimensions = SizesMap[size].pie;
  return (
    <Flex
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap="size-100"
    >
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
            animationDuration={disableAnimation ? 0 : undefined}
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
      <MeanScore
        fallback={meanScoreFallback}
        value={meanScore}
        size={size === "S" ? size : "L"}
      />
    </Flex>
  );
}

export function SummaryValueBreakdown({
  annotationName,
  labelFractions,
  meanScore,
}: {
  annotationName: string;
  labelFractions?: readonly { label: string; fraction: number }[];
  meanScore?: number | null;
}) {
  const colors = useAnnotationSummaryChartColors(annotationName);
  const hasMeanScore = typeof meanScore === "number" && !isNaN(meanScore);
  const hasLabelFractions =
    Array.isArray(labelFractions) && labelFractions.length > 0;
  return (
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
            <Text>mean score</Text>
            <MeanScore value={meanScore} />
          </Flex>
        ) : null}
      </Flex>
    </View>
  );
}
