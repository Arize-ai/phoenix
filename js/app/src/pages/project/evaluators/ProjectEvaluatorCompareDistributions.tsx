import { css } from "@emotion/react";
import { graphql, useFragment } from "react-relay";
import { useSearchParams } from "react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, Flex, Text } from "@phoenix/components";
import {
  AnnotationMetricsViewMenu,
  ChartEmptyStateOverlay,
  ChartResponsiveContainer,
  ChartTooltip,
  ChartTooltipItem,
  compactChartMargin,
  compactYAxisProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  defaultXAxisProps,
} from "@phoenix/components/chart";
import type { AnnotationMetricsView } from "@phoenix/components/chart/annotationMetricsUtils";
import type { EvaluatorOptimizationDirection } from "@phoenix/types/evaluators";
import {
  formatFloat,
  formatInt,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type { ProjectEvaluatorCompareDistributions_comparison$key } from "./__generated__/ProjectEvaluatorCompareDistributions_comparison.graphql";
import { EVALUATOR_COMPARE_COLORS } from "./projectEvaluatorCompareUtils";
import {
  getDistributionView,
  getDistributionRows,
  getDistributionThresholdPosition,
  type DistributionSide,
  type DistributionChartRow,
} from "./projectEvaluatorDistributionUtils";
import { formatEvaluationTargetPlural } from "./projectEvaluatorTypes";

const panelCSS = css`
  min-width: 0;
  .card__body {
    display: grid;
  }
  .evaluator-distributions__charts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--global-dimension-size-300);
    padding: var(--global-dimension-size-200);
  }
  .evaluator-distributions__side {
    min-width: 0;
  }
  .evaluator-distributions__name {
    overflow-wrap: anywhere;
  }
  .evaluator-distributions__plot {
    flex: 1;
    min-height: 230px;
  }
`;

export function ProjectEvaluatorCompareDistributions({
  comparisonRef,
  evaluatorAId,
  evaluatorBId,
  evaluatorAName,
  evaluatorBName,
  evaluatorAOptimizationDirection,
  evaluatorBOptimizationDirection,
}: {
  comparisonRef: ProjectEvaluatorCompareDistributions_comparison$key;
  evaluatorAId: string;
  evaluatorBId: string;
  evaluatorAName: string;
  evaluatorBName: string;
  evaluatorAOptimizationDirection: EvaluatorOptimizationDirection | null;
  evaluatorBOptimizationDirection: EvaluatorOptimizationDirection | null;
}) {
  const comparison = useFragment(
    graphql`
      fragment ProjectEvaluatorCompareDistributions_comparison on ProjectEvaluatorComparison {
        evaluationTarget
        coverage {
          evaluatedByBoth
          onlyA
          onlyB
        }
        sideA {
          ...ProjectEvaluatorCompareDistributions_side @relay(mask: false)
        }
        sideB {
          ...ProjectEvaluatorCompareDistributions_side @relay(mask: false)
        }
      }
    `,
    comparisonRef
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const sides = [
    {
      side: comparison.sideA,
      id: evaluatorAId,
      name: evaluatorAName,
      color: EVALUATOR_COMPARE_COLORS.a,
      only: comparison.coverage.onlyA,
      direction: evaluatorAOptimizationDirection,
    },
    {
      side: comparison.sideB,
      id: evaluatorBId,
      name: evaluatorBName,
      color: EVALUATOR_COMPARE_COLORS.b,
      only: comparison.coverage.onlyB,
      direction: evaluatorBOptimizationDirection,
    },
  ].map((item) => {
    const param = `distributionView.${item.id}`;
    const view = getDistributionView({
      side: item.side,
      requested: searchParams.get(param),
    });
    return {
      ...item,
      param,
      view,
      rows: getDistributionRows({ side: item.side, view }),
    };
  });
  const maximum = sides.reduce(
    (maximum, { rows }) =>
      rows.reduce((maximum, row) => Math.max(maximum, row.count), maximum),
    1
  );
  const hasScores = sides.some(({ view }) => view === "scores");
  const hasLabels = sides.some(({ view }) => view === "labels");
  const title =
    hasScores && hasLabels
      ? "Score and label distributions"
      : hasScores
        ? "Score distributions"
        : "Label distributions";
  const target = formatEvaluationTargetPlural(comparison.evaluationTarget);

  return (
    <div css={panelCSS}>
      <Card title={title} height="100%" titleSeparator={false}>
        <div className="evaluator-distributions__charts">
          {sides.map((item) => (
            <DistributionChart
              key={item.id}
              {...item}
              evaluatedCount={comparison.coverage.evaluatedByBoth + item.only}
              maximum={maximum}
              target={target}
              onViewChange={(view) =>
                setSearchParams((previous) => {
                  const next = new URLSearchParams(previous);
                  next.set(item.param, view);
                  return next;
                })
              }
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

export const projectEvaluatorDistributionSideFragment = graphql`
  fragment ProjectEvaluatorCompareDistributions_side on EvaluatorComparisonSide {
    threshold
    allEvaluatedMeanScore
    scoreBinEdges
    scoreBinCounts
    scoreValueCounts {
      score
      count
    }
    labelCounts {
      label
      score
      isOther
      count
    }
  }
`;

function DistributionChart({
  side,
  name,
  color,
  view,
  rows,
  direction,
  evaluatedCount,
  maximum,
  target,
  onViewChange,
}: {
  side: DistributionSide;
  name: string;
  color: string;
  view: AnnotationMetricsView;
  rows: DistributionChartRow[];
  direction: EvaluatorOptimizationDirection | null;
  evaluatedCount: number;
  maximum: number;
  target: string;
  onViewChange: (view: AnnotationMetricsView) => void;
}) {
  const data = rows.map((row, index) => ({ ...row, x: index }));
  const chartedCount = rows.reduce((total, row) => total + row.count, 0);
  const meanScore = side.allEvaluatedMeanScore;
  const threshold = view === "scores" ? side.threshold : null;
  const thresholdPosition = getDistributionThresholdPosition({
    rows,
    threshold,
  });

  return (
    <section
      className="evaluator-distributions__side"
      aria-label={`${name} ${view} distribution`}
    >
      <Flex direction="column" gap="size-100" height="100%">
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="start"
          gap="size-100"
        >
          <Text size="S" className="evaluator-distributions__name">
            <Text weight="heavy">{name}</Text>
            {meanScore != null ? (
              <Text color="text-700"> · mean {formatFloat(meanScore)}</Text>
            ) : null}
          </Text>
          {(side.scoreBinCounts || side.scoreValueCounts) &&
          side.labelCounts ? (
            <AnnotationMetricsViewMenu view={view} onChange={onViewChange} />
          ) : null}
        </Flex>
        <div className="evaluator-distributions__plot">
          <ChartEmptyStateOverlay
            isEmpty={chartedCount === 0}
            message={
              evaluatedCount === 0
                ? `No ${target} evaluated in this time range`
                : `No ${view} available for these results`
            }
            chartType="bar"
          >
            <ChartResponsiveContainer>
              <BarChart
                data={data}
                margin={{ ...compactChartMargin, top: 24, left: 8, bottom: 8 }}
                accessibilityLayer
              >
                <CartesianGrid {...defaultCartesianGridProps} />
                <XAxis
                  {...defaultXAxisProps}
                  dataKey="x"
                  type="number"
                  domain={[-0.5, Math.max(0.5, data.length - 0.5)]}
                  ticks={data.map((row) => row.x)}
                  tickFormatter={(value) => data[value]?.label ?? ""}
                  minTickGap={16}
                  tickLine={false}
                  height={44}
                  label={{
                    value: view === "scores" ? "Score" : "Label",
                    position: "insideBottom",
                    offset: 0,
                    fontSize: 11,
                    fill: "var(--chart-axis-text-color)",
                  }}
                />
                <YAxis
                  {...compactYAxisProps}
                  domain={[0, maximum]}
                  allowDecimals={false}
                  tickFormatter={intShortFormatter}
                  width={40}
                  label={{
                    value: target.charAt(0).toUpperCase() + target.slice(1),
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 11,
                    fill: "var(--chart-axis-text-color)",
                    style: { textAnchor: "middle" },
                  }}
                />
                <Tooltip
                  {...defaultTooltipProps}
                  content={({ active, label }) => {
                    const row = data[Number(label)];
                    if (!active || !row) return null;
                    return (
                      <ChartTooltip>
                        <Text weight="heavy" size="S">
                          {row.description ?? row.label}
                        </Text>
                        {view === "labels" && row.score != null ? (
                          <Text size="XS">Mapped score: {row.score}</Text>
                        ) : null}
                        <ChartTooltipItem
                          name={name}
                          shape="square"
                          color={color}
                          value={formatInt(row.count)}
                        />
                        <Text size="XS">
                          {formatFloat((row.count / chartedCount) * 100)}% of
                          plotted {target}
                        </Text>
                      </ChartTooltip>
                    );
                  }}
                />
                <Bar
                  dataKey="count"
                  name={name}
                  fill={color}
                  isAnimationActive={false}
                  maxBarSize={40}
                  radius={[3, 3, 0, 0]}
                />
                {thresholdPosition != null ? (
                  <ReferenceLine
                    x={thresholdPosition}
                    stroke="var(--global-color-gray-700)"
                    strokeDasharray="4 4"
                    label={{
                      value: `flag ${direction === "MAXIMIZE" ? "≤" : "≥"} ${threshold}`,
                      position: "insideTopRight",
                      fontSize: 11,
                      fill: "var(--chart-axis-text-color)",
                    }}
                  />
                ) : null}
              </BarChart>
            </ChartResponsiveContainer>
          </ChartEmptyStateOverlay>
        </div>
      </Flex>
    </section>
  );
}
