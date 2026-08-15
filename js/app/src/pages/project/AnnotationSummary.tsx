import React, {
  startTransition,
  Suspense,
  useEffect,
  useEffectEvent,
} from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";
import { useParams } from "react-router";
import { Cell, Pie, PieChart } from "recharts";

import {
  Flex,
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@phoenix/components";
import type { AnnotationConfig } from "@phoenix/components/annotation";
import { MeanScore } from "@phoenix/components/annotation/MeanScore";
import {
  ChartTooltipDivider,
  ChartTooltipItem,
  useSequentialChartColors,
} from "@phoenix/components/chart";
import type {
  ComponentSize,
  SizingProps,
  TextSize,
} from "@phoenix/components/core/types";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { useTimeRange } from "@phoenix/components/datetime";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useWordColor } from "@phoenix/hooks/useWordColor";
import type { Mutable } from "@phoenix/typeUtils";
import { formatPercent } from "@phoenix/utils/numberFormatUtils";

import type { AnnotationSummaryQuery } from "./__generated__/AnnotationSummaryQuery.graphql";
import type { AnnotationSummaryValueFragment$key } from "./__generated__/AnnotationSummaryValueFragment.graphql";

type AnnotationSummaryProps = {
  annotationName: string;
  /**
   * Optional span filter condition. When set, the annotation summary is
   * restricted to spans matching the condition.
   */
  filterCondition?: string | null;
};
export function AnnotationSummary({
  annotationName,
  filterCondition,
}: AnnotationSummaryProps) {
  const { projectId } = useParams();
  const { timeRangeISOStrings } = useTimeRange();
  const data = useLazyLoadQuery<AnnotationSummaryQuery>(
    graphql`
      query AnnotationSummaryQuery(
        $id: ID!
        $annotationName: String!
        $timeRange: TimeRange!
        $filterCondition: String
      ) {
        project: node(id: $id) {
          ...AnnotationSummaryValueFragment
            @arguments(
              annotationName: $annotationName
              timeRange: $timeRange
              filterCondition: $filterCondition
            )
        }
      }
    `,
    {
      annotationName,
      id: projectId as string,
      timeRange: timeRangeISOStrings,
      filterCondition: filterCondition || null,
    }
  );
  return (
    <Summary name={annotationName}>
      <AnnotationSummaryValue
        annotationName={annotationName}
        filterCondition={filterCondition || null}
        project={data.project}
      />
    </Summary>
  );
}

function AnnotationSummaryValue(props: {
  annotationName: string;
  filterCondition: string | null;
  project: AnnotationSummaryValueFragment$key;
}) {
  const { project, annotationName, filterCondition } = props;
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
        filterCondition: { type: "String", defaultValue: null }
      ) {
        annotationConfigs {
          edges {
            node {
              ... on AnnotationConfigBase {
                annotationType
              }
              ... on CategoricalAnnotationConfig {
                annotationType
                id
                optimizationDirection
                name
                values {
                  label
                  score
                }
              }
            }
          }
        }
        spanAnnotationSummary(
          annotationName: $annotationName
          timeRange: $timeRange
          filterCondition: $filterCondition
        ) {
          name
          count
          scoreCount
          labelCount
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

  useRefetchOnStreamAdvance(() => {
    startTransition(() => {
      refetch({ filterCondition }, { fetchPolicy: "store-and-network" });
    });
  });

  return (
    <AnnotationSummaryValueView
      name={annotationName}
      summary={data?.spanAnnotationSummary}
      annotationConfigs={data?.annotationConfigs}
    />
  );
}

/**
 * Refetch an annotation summary whenever streaming data advances. Shared by the
 * span- and trace-level summary components so the stream-refetch wiring lives in
 * one place.
 */
export function useRefetchOnStreamAdvance(refetch: () => void) {
  const { fetchKey } = useStreamState();
  const onStreamAdvance = useEffectEvent(refetch);
  useEffect(() => {
    onStreamAdvance();
  }, [fetchKey]);
}

type AnnotationSummaryData = {
  meanScore?: number | null;
  count?: number | null;
  scoreCount?: number | null;
  labelCount?: number | null;
  labelFractions?: readonly { label: string; fraction: number }[];
};

/**
 * Renders a {@link SummaryValue} from a project annotation summary, resolving the
 * matching annotation config by name. Shared by the span- and trace-level
 * summary components, which differ only in which GraphQL summary field they read.
 */
export function AnnotationSummaryValueView({
  name,
  summary,
  annotationConfigs,
}: {
  name: string;
  summary?: AnnotationSummaryData | null;
  annotationConfigs?: {
    readonly edges: readonly {
      readonly node: { readonly name?: string | null };
    }[];
  } | null;
}) {
  return (
    <SummaryValue
      name={name}
      meanScore={summary?.meanScore}
      labelFractions={summary?.labelFractions}
      count={summary?.count}
      scoreCount={summary?.scoreCount}
      labelCount={summary?.labelCount}
      annotationConfig={
        annotationConfigs?.edges.find((edge) => edge.node.name === name)
          ?.node as AnnotationConfig | undefined
      }
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

/**
 * Generate a stable-ish color for a given label and annotation config.
 * If there is no annotation config, or the annotation config is not categorical,
 * we will use the fallback index to generate a color.
 *
 * Otherwise, we will sort the categorical values by label, and then use the index of the label
 * to generate a color.
 *
 * This ensures that the color is stable for a given label, and will only change if the label changes.
 *
 * @param colors
 * @param index
 * @param label
 * @param annotationConfig
 */
function getStableColor(
  colors: string[],
  fallbackIndex: number,
  label: string,
  annotationConfig?: AnnotationConfig
) {
  if (
    !annotationConfig ||
    annotationConfig.annotationType !== "CATEGORICAL" ||
    !annotationConfig.values
  ) {
    return colors[fallbackIndex % colors.length];
  }

  const sortedLabels = [...annotationConfig.values]
    .sort((a, b) => {
      // sort by score + annotationConfig.optimizationDirection
      const aScore = a.score ?? 0;
      const bScore = b.score ?? 0;
      return (
        (annotationConfig.optimizationDirection === "MAXIMIZE" ? -1 : 1) *
        (aScore - bScore)
      );
    })
    .map((v) => v.label);
  const index = sortedLabels.indexOf(label);
  return colors[index % colors.length];
}

function useAnnotationSummaryChartColors(name: string) {
  const chartColors = useSequentialChartColors();
  const primaryColor = useWordColor(name);
  const colors = [
    primaryColor,
    chartColors.gray300,
    chartColors.gray400,
    chartColors.gray500,
    chartColors.gray600,
  ];
  return colors;
}

type SummaryValueProps = SummaryValuePreviewProps & {
  count?: number | null;
  scoreCount?: number | null;
  labelCount?: number | null;
};

export function SummaryValue({
  name,
  meanScore,
  labelFractions,
  size = "M",
  disableAnimation = false,
  meanScoreFallback,
  annotationConfig,
  count,
  scoreCount,
  labelCount,
}: SummaryValueProps) {
  const hasMeanScore = typeof meanScore === "number";
  const hasLabelFractions =
    Array.isArray(labelFractions) && labelFractions.length > 0;
  if (!hasMeanScore && !hasLabelFractions) {
    return <Text size="L">--</Text>;
  }

  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap>
        <SummaryValuePreview
          name={name}
          meanScore={meanScore}
          labelFractions={labelFractions}
          size={size}
          disableAnimation={disableAnimation}
          meanScoreFallback={meanScoreFallback}
          annotationConfig={annotationConfig}
        />
      </TriggerWrap>
      <RichTooltip placement="bottom">
        <SummaryValueBreakdown
          annotationName={name}
          labelFractions={labelFractions}
          meanScore={meanScore}
          annotationConfig={annotationConfig}
          count={count}
          scoreCount={scoreCount}
          labelCount={labelCount}
        />
      </RichTooltip>
    </TooltipTrigger>
  );
}

type SummaryValuePreviewProps = {
  name: string;
  meanScore?: number | null;
  labelFractions?: readonly { label: string; fraction: number }[];
  disableAnimation?: boolean;
  /**
   * Fallback to display when there is no mean score.
   * Set to null to not display a fallback.
   * @default "--"
   */
  meanScoreFallback?: React.ReactNode;
  /**
   * The annotation config for the annotation, if available.
   */
  annotationConfig?: AnnotationConfig;
} & SizingProps;

export function SummaryValuePreview({
  name,
  meanScore,
  labelFractions,
  size = "M",
  disableAnimation,
  meanScoreFallback,
  annotationConfig,
}: SummaryValuePreviewProps) {
  const colors = useAnnotationSummaryChartColors(name);
  const hasMeanScore = typeof meanScore === "number";
  const hasLabelFractions = labelFractions && labelFractions.length > 0;
  if (!hasMeanScore && !hasLabelFractions) {
    return <Text size="L">--</Text>;
  }
  const chartDimensions = SizesMap[size].chart;
  const pieDimensions = SizesMap[size].pie;
  return (
    <Flex direction="row" alignItems="center" gap="size-100">
      {hasLabelFractions ? (
        <PieChart {...chartDimensions}>
          <Pie
            data={labelFractions as Mutable<typeof labelFractions>}
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
                fill={getStableColor(
                  colors,
                  index,
                  entry.label,
                  annotationConfig
                )}
              />
            ))}
          </Pie>
        </PieChart>
      ) : null}
      {hasMeanScore ? (
        <MeanScore
          fallback={meanScoreFallback}
          value={meanScore}
          size={size === "S" ? size : "L"}
        />
      ) : (
        // When there is no mean score, a "--" mean score next to the pie chart
        // is hard to parse. Show the most common labels instead, matching the
        // text size of the mean score it replaces.
        <SummaryValueLabelPreview
          labelFractions={labelFractions ?? []}
          size={size === "S" ? "S" : "L"}
        />
      )}
    </Flex>
  );
}

const MAX_VISIBLE_LABELS = 2;

export function SummaryValueLabelPreview({
  labelFractions,
  size = "M",
}: {
  labelFractions: readonly { label: string; fraction: number }[];
  /**
   * The text size for the labels. Defaults to "M" for use in compact contexts
   * such as table cells.
   */
  size?: TextSize;
}) {
  if (labelFractions.length === 0) {
    return null;
  }
  const sortedLabels = [...labelFractions].sort(
    (a, b) => b.fraction - a.fraction
  );
  const visibleLabels = sortedLabels.slice(0, MAX_VISIBLE_LABELS);
  const remainingCount = sortedLabels.length - visibleLabels.length;
  return (
    <Flex
      direction="row"
      alignItems="baseline"
      gap="size-100"
      minWidth={0}
      maxWidth="100%"
    >
      <Truncate maxWidth="100%">
        <Text size={size}>
          {visibleLabels.map((entry) => entry.label).join(", ")}
        </Text>
      </Truncate>
      {remainingCount > 0 && (
        <Text
          color="text-700"
          size="S"
          flex="none"
        >{`+ ${remainingCount} more`}</Text>
      )}
    </Flex>
  );
}

export function SummaryValueBreakdown({
  annotationName,
  labelFractions,
  meanScore,
  annotationConfig,
  count,
  scoreCount,
  labelCount,
}: {
  annotationName: string;
  labelFractions?: readonly { label: string; fraction: number }[];
  meanScore?: number | null;
  annotationConfig?: AnnotationConfig;
  count?: number | null;
  scoreCount?: number | null;
  labelCount?: number | null;
}) {
  const colors = useAnnotationSummaryChartColors(annotationName);
  const hasMeanScore = typeof meanScore === "number" && !isNaN(meanScore);
  const hasLabelFractions = labelFractions && labelFractions.length > 0;
  // Only surface coverage when some — but not all — values are present. A count
  // of 0 means the annotation simply isn't scored/labeled, so "0 of N" would be
  // misleading rather than informative.
  const isScorePartial =
    typeof scoreCount === "number" &&
    typeof count === "number" &&
    scoreCount > 0 &&
    scoreCount < count;
  const isLabelPartial =
    typeof labelCount === "number" &&
    typeof count === "number" &&
    labelCount > 0 &&
    labelCount < count;
  const hasCoverage = isScorePartial || isLabelPartial;
  return (
    <View width="size-2400">
      <Flex direction="column" gap="size-50">
        {hasLabelFractions && (
          <ul>
            {labelFractions.map((entry, index) => (
              <li key={entry.label}>
                <ChartTooltipItem
                  color={getStableColor(
                    colors,
                    index,
                    entry.label,
                    annotationConfig
                  )}
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
        {hasCoverage && (hasLabelFractions || hasMeanScore) ? (
          <ChartTooltipDivider />
        ) : null}
        {isScorePartial ? (
          <Text
            color="text-700"
            size="S"
          >{`${scoreCount} of ${count} scored`}</Text>
        ) : null}
        {isLabelPartial ? (
          <Text
            color="text-700"
            size="S"
          >{`${labelCount} of ${count} labeled`}</Text>
        ) : null}
      </Flex>
    </View>
  );
}

/**
 * A component that displays the highest proportion label, and a count of the total number of labels
 * annotated for the given annotation name. On hover, it displays a tooltip with the breakdown of the
 * labels.
 */
export function SummaryValueLabels({
  name,
  labelFractions,
  annotationConfig,
}: {
  name: string;
  labelFractions: readonly { label: string; fraction: number }[];
  annotationConfig?: AnnotationConfig;
}) {
  if (labelFractions.length === 0) {
    return null;
  }
  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap>
        <SummaryValueLabelPreview labelFractions={labelFractions} />
      </TriggerWrap>
      <RichTooltip placement="bottom">
        <SummaryValueBreakdown
          annotationName={name}
          labelFractions={labelFractions}
          annotationConfig={annotationConfig}
        />
      </RichTooltip>
    </TooltipTrigger>
  );
}
