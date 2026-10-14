import { css } from "@emotion/react";
import { graphql, useFragment } from "react-relay";
import { useSearchParams } from "react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Button,
  Card,
  ColorSwatch,
  Flex,
  Icon,
  Icons,
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
  Text,
} from "@phoenix/components";
import {
  AnnotationScoreText,
  type AnnotationOptimizationConfig,
  getPositiveOptimizationFromConfig,
  toAnnotationOptimizationConfig,
} from "@phoenix/components/annotation";
import {
  ChartEmptyStateOverlay,
  ChartResponsiveContainer,
  ChartTooltip,
  ChartTooltipItem,
  compactTimeXAxisProps,
  compactYAxisProps,
  defaultCartesianGridProps,
  defaultTooltipProps,
  defaultXAxisProps,
} from "@phoenix/components/chart";
import type { AnnotationMetricsView } from "@phoenix/components/chart/annotationMetricsUtils";
import {
  formatFloat,
  formatInt,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type { ProjectEvaluatorCompareDistributions_comparison$key } from "./__generated__/ProjectEvaluatorCompareDistributions_comparison.graphql";
import type { ProjectEvaluatorCompareDistributions_evaluator$key } from "./__generated__/ProjectEvaluatorCompareDistributions_evaluator.graphql";
import type { ProjectEvaluatorCompareDistributions_side$key } from "./__generated__/ProjectEvaluatorCompareDistributions_side.graphql";
import {
  EVALUATOR_COMPARE_HUES,
  type EvaluatorCompareHue,
  getConfiguredScores,
  getShadeColor,
  getPositionalShades,
  NEUTRAL_LABEL_COLOR,
} from "./projectEvaluatorCompareUtils";
import {
  COMPARE_CHART_MARGIN,
  COMPARE_LABELED_Y_AXIS_WIDTH,
  compareChartFooterCSS,
  compareChartToolbarCSS,
  getCompareYAxisLabel,
  ProjectEvaluatorCompareViewToggle,
} from "./ProjectEvaluatorCompareViewToggle";
import {
  formatScoreValue,
  getDistributionRows,
  getDistributionScope,
  getDistributionThresholdPosition,
  getRankedScoreRowShades,
  orderLabelRowsBestFirst,
  getDistributionView,
  type DistributionScope,
  type DistributionSide,
  type DistributionChartRow,
} from "./projectEvaluatorDistributionUtils";
import { formatEvaluationTargetPlural } from "./projectEvaluatorTypes";

const panelCSS = css`
  min-width: 0;
  height: 100%;
  .card__body {
    display: grid;
    min-height: 0;
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
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .evaluator-distributions__footer {
    justify-content: center;
    gap: var(--global-dimension-size-200);
  }
  .evaluator-distributions__legend-item {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
  }
  .evaluator-distributions__plot {
    flex: 1;
    min-height: 0;
  }
`;

const DISTRIBUTION_SCOPE_PARAM = "distributionScope";

const evaluatorFragment = graphql`
  fragment ProjectEvaluatorCompareDistributions_evaluator on ProjectEvaluator
  @argumentDefinitions(timeRange: { type: "TimeRange!" }) {
    id
    name
    evaluationTarget
    distribution(timeRange: $timeRange) {
      ...ProjectEvaluatorCompareDistributions_side
    }
    evaluator {
      outputConfigs {
        ... on AnnotationConfigBase {
          annotationType
        }
        ... on CategoricalAnnotationConfig {
          optimizationDirection
          values {
            label
            score
          }
        }
        ... on ContinuousAnnotationConfig {
          optimizationDirection
          lowerBound
          upperBound
        }
        ... on FreeformAnnotationConfig {
          optimizationDirection
          threshold
          lowerBound
          upperBound
        }
      }
    }
  }
`;

const comparisonFragment = graphql`
  fragment ProjectEvaluatorCompareDistributions_comparison on ProjectEvaluatorComparison {
    coverage {
      evaluatedByBoth
    }
    a {
      sharedDistribution {
        ...ProjectEvaluatorCompareDistributions_side
      }
    }
    b {
      sharedDistribution {
        ...ProjectEvaluatorCompareDistributions_side
      }
    }
  }
`;

export function ProjectEvaluatorCompareDistributions({
  comparisonRef,
  evaluatorARef,
  evaluatorBRef,
}: {
  comparisonRef: ProjectEvaluatorCompareDistributions_comparison$key;
  evaluatorARef: ProjectEvaluatorCompareDistributions_evaluator$key;
  evaluatorBRef: ProjectEvaluatorCompareDistributions_evaluator$key;
}) {
  const comparison =
    useFragment<ProjectEvaluatorCompareDistributions_comparison$key>(
      comparisonFragment,
      comparisonRef
    );
  const evaluatorA =
    useFragment<ProjectEvaluatorCompareDistributions_evaluator$key>(
      evaluatorFragment,
      evaluatorARef
    );
  const evaluatorB =
    useFragment<ProjectEvaluatorCompareDistributions_evaluator$key>(
      evaluatorFragment,
      evaluatorBRef
    );
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = getDistributionScope({
    requested: searchParams.get(DISTRIBUTION_SCOPE_PARAM),
    evaluatedByBoth: comparison.coverage.evaluatedByBoth,
  });
  const isOverlap = scope === "overlap";
  const sideA = useFragment<ProjectEvaluatorCompareDistributions_side$key>(
    projectEvaluatorDistributionSideFragment,
    isOverlap ? comparison.a.sharedDistribution : evaluatorA.distribution
  );
  const sideB = useFragment<ProjectEvaluatorCompareDistributions_side$key>(
    projectEvaluatorDistributionSideFragment,
    isOverlap ? comparison.b.sharedDistribution : evaluatorB.distribution
  );
  const sides = (
    [
      ["a", evaluatorA, sideA],
      ["b", evaluatorB, sideB],
    ] as const
  ).map(([key, evaluator, side]) => {
    const param = `distributionView.${evaluator.id}`;
    const view = getDistributionView({
      side,
      requested: searchParams.get(param),
    });
    return {
      side,
      id: evaluator.id,
      name: evaluator.name,
      hue: EVALUATOR_COMPARE_HUES[key],
      optimizationConfig: toAnnotationOptimizationConfig(
        evaluator.evaluator.outputConfigs[0] ?? {}
      ),
      param,
      view,
      rows: getDistributionRows({ side, view }),
    };
  });
  const maximum = sides.reduce(
    (maximum, { rows }) =>
      rows.reduce((maximum, row) => Math.max(maximum, row.count), maximum),
    1
  );
  const target = formatEvaluationTargetPlural(evaluatorA.evaluationTarget);

  return (
    <div css={panelCSS}>
      <Card
        title="Distributions"
        extra={
          <DistributionScopePicker
            scope={scope}
            target={target}
            evaluatedByBoth={comparison.coverage.evaluatedByBoth}
            onScopeChange={(next) =>
              setSearchParams(
                (previous) => {
                  const params = new URLSearchParams(previous);
                  params.set(DISTRIBUTION_SCOPE_PARAM, next);
                  return params;
                },
                { replace: true }
              )
            }
          />
        }
        height="100%"
        titleSeparator={false}
      >
        <div className="evaluator-distributions__charts">
          {sides.map((item) => (
            <DistributionChart
              key={item.id}
              {...item}
              maximum={maximum}
              target={target}
              scope={scope}
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

/** Picks which targets the distributions cover. */
function DistributionScopePicker({
  scope,
  target,
  evaluatedByBoth,
  onScopeChange,
}: {
  scope: DistributionScope;
  target: string;
  evaluatedByBoth: number;
  onScopeChange: (scope: DistributionScope) => void;
}) {
  const options: ReadonlyArray<{ scope: DistributionScope; label: string }> = [
    {
      scope: "overlap",
      label: `${formatInt(evaluatedByBoth)} ${target} evaluated by both`,
    },
    { scope: "all", label: `All evaluated ${target}` },
  ];
  const selected = options.find((option) => option.scope === scope);
  return (
    <MenuTrigger>
      <Button
        size="S"
        aria-label={`Distribution population: ${selected?.label}`}
        trailingVisual={<Icon svg={<Icons.ChevronDown />} />}
      >
        {selected?.label}
      </Button>
      <MenuContainer placement="bottom end" minHeight="auto">
        <Menu
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[scope]}
          // Nothing to chart when no target has both results.
          disabledKeys={evaluatedByBoth === 0 ? ["overlap"] : []}
          onSelectionChange={(keys) => {
            if (keys === "all") return;
            const [next] = keys;
            if (next === "overlap" || next === "all") onScopeChange(next);
          }}
        >
          {options.map((option) => (
            <MenuItem key={option.scope} id={option.scope}>
              {option.label}
            </MenuItem>
          ))}
        </Menu>
      </MenuContainer>
    </MenuTrigger>
  );
}

const projectEvaluatorDistributionSideFragment = graphql`
  fragment ProjectEvaluatorCompareDistributions_side on EvaluatorDistribution {
    threshold
    evaluatedCount
    meanScore
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

type CategoryTickProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  payload?: { value?: unknown };
};

const CATEGORY_TICK_HEIGHT = 16;

/**
 * A category axis tick that always renders, truncated with an ellipsis to its
 * bar's share of the axis; the full label shows on hover.
 */
function CategoryAxisTick({
  x,
  y,
  width,
  label,
  bandCount,
}: CategoryTickProps & { label: string | undefined; bandCount: number }) {
  const band = Number(width) / Math.max(bandCount, 1);
  if (!label || !Number.isFinite(band)) return null;
  return (
    <foreignObject
      x={Number(x) - band / 2}
      y={Number(y)}
      width={band}
      height={CATEGORY_TICK_HEIGHT}
    >
      <div css={categoryTickCSS} title={label}>
        {label}
      </div>
    </foreignObject>
  );
}

const categoryTickCSS = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  padding-inline: 2px;
  font-size: 12px;
  line-height: ${CATEGORY_TICK_HEIGHT}px;
  color: var(--chart-axis-text-color);
`;

function DistributionChart({
  side,
  name,
  hue,
  view,
  rows: unorderedRows,
  optimizationConfig,
  maximum,
  target,
  scope,
  onViewChange,
}: {
  side: DistributionSide;
  name: string;
  hue: EvaluatorCompareHue;
  view: AnnotationMetricsView;
  rows: DistributionChartRow[];
  optimizationConfig: AnnotationOptimizationConfig | undefined;
  maximum: number;
  target: string;
  scope: DistributionScope;
  onViewChange: (view: AnnotationMetricsView) => void;
}) {
  const direction = optimizationConfig?.optimizationDirection;
  const referenceScores = getConfiguredScores(optimizationConfig);
  // Bars are always shades of the evaluator's hue, ranked by optimization
  // direction when there is one. Without one, scores shade by value (higher
  // stronger) and labels step through the shades in display order.
  const { rows, shades: rankedShades } =
    view === "labels"
      ? orderLabelRowsBestFirst({
          rows: unorderedRows,
          direction,
          referenceScores,
        })
      : {
          rows: unorderedRows,
          shades: getRankedScoreRowShades({
            rows: unorderedRows,
            direction: direction === "MINIMIZE" ? "MINIMIZE" : "MAXIMIZE",
            referenceScores,
          }),
        };
  const shades = rankedShades ?? getPositionalShades(rows.length);
  const getFill = (row: DistributionChartRow, index: number) =>
    row.isOther
      ? NEUTRAL_LABEL_COLOR
      : getShadeColor({ hue, shade: shades[index] ?? null });
  const data = rows.map((row, index) => ({
    ...row,
    x: index,
    fill: getFill(row, index),
  }));
  // A label without a mapped score cannot rank, so it draws neutral gray.
  const hasUnscoredLabel =
    view === "labels" &&
    rows.some((row, index) => !row.isOther && shades[index] == null);
  const chartedCount = rows.reduce((total, row) => total + row.count, 0);
  const meanScore = side.meanScore;
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
        <div css={compareChartToolbarCSS}>
          <Text
            size="S"
            weight="heavy"
            className="evaluator-distributions__name"
            title={name}
          >
            {name}
          </Text>
          <ProjectEvaluatorCompareViewToggle
            aria-label={`${name} distribution view`}
            view={view}
            availableViews={[
              ...(side.scoreBinCounts || side.scoreValueCounts
                ? (["scores"] as const)
                : []),
              ...(side.labelCounts ? (["labels"] as const) : []),
            ]}
            onViewChange={onViewChange}
          />
        </div>
        <div className="evaluator-distributions__plot">
          <ChartEmptyStateOverlay
            isEmpty={chartedCount === 0}
            message={
              side.evaluatedCount === 0
                ? scope === "overlap"
                  ? `No ${target} evaluated by both in this time range`
                  : `No ${target} evaluated in this time range`
                : `No ${view} available for these results`
            }
            chartType="bar"
          >
            <ChartResponsiveContainer>
              <BarChart
                data={data}
                margin={{ ...COMPARE_CHART_MARGIN, left: 8 }}
                accessibilityLayer
              >
                <CartesianGrid {...defaultCartesianGridProps} />
                <XAxis
                  {...defaultXAxisProps}
                  dataKey="x"
                  type="number"
                  domain={[-0.5, Math.max(0.5, data.length - 0.5)]}
                  ticks={data.map((row) => row.x)}
                  tickLine={false}
                  {...(view === "labels"
                    ? {
                        // Every label names a bar, so none is skipped; each
                        // truncates to its bar's width instead.
                        interval: 0,
                        tick: (props: CategoryTickProps) => (
                          <CategoryAxisTick
                            {...props}
                            label={data[Number(props.payload?.value)]?.label}
                            bandCount={data.length}
                          />
                        ),
                      }
                    : {
                        tickFormatter: (value: number) =>
                          data[value]?.label ?? "",
                        minTickGap: 16,
                      })}
                  // The time chart's axis height, so both cards' baselines
                  // line up above their footer rows.
                  height={compactTimeXAxisProps.height}
                />
                <YAxis
                  {...compactYAxisProps}
                  domain={[0, maximum]}
                  allowDecimals={false}
                  tickFormatter={intShortFormatter}
                  width={COMPARE_LABELED_Y_AXIS_WIDTH}
                  label={getCompareYAxisLabel({
                    value: target.charAt(0).toUpperCase() + target.slice(1),
                  })}
                />
                <RechartsTooltip
                  {...defaultTooltipProps}
                  content={({ active, label }) => {
                    const row = data[Number(label)];
                    if (!active || !row) return null;
                    return (
                      <ChartTooltip>
                        <Text weight="heavy" size="S">
                          {row.description ?? row.label}
                        </Text>
                        {view === "labels" && !row.isOther ? (
                          <Text size="XS">
                            {row.score != null
                              ? `Mapped score: ${formatScoreValue(row.score)}`
                              : "No score"}
                          </Text>
                        ) : null}
                        <ChartTooltipItem
                          name={name}
                          shape="square"
                          color={row.fill}
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
                  isAnimationActive={false}
                  maxBarSize={40}
                  radius={[3, 3, 0, 0]}
                >
                  {data.map((row) => (
                    <Cell key={row.x} fill={row.fill} />
                  ))}
                </Bar>
                {thresholdPosition != null && threshold != null ? (
                  <ReferenceLine
                    x={thresholdPosition}
                    stroke="var(--global-color-gray-700)"
                    strokeDasharray="4 4"
                    label={{
                      value: `flag ${direction === "MAXIMIZE" ? "≤" : "≥"} ${formatScoreValue(threshold)}`,
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
        {/* The side's mean score, in the row the time chart keeps its legend
            in; the mean takes the tint scores have elsewhere. A gray bar gets
            one legend item explaining it. */}
        <div
          css={compareChartFooterCSS}
          className="evaluator-distributions__footer"
        >
          {meanScore == null ? null : (
            <Text color="text-700">
              {"Mean score "}
              <AnnotationScoreText
                positiveOptimization={getPositiveOptimizationFromConfig({
                  config: optimizationConfig,
                  score: meanScore,
                })}
              >
                {formatFloat(meanScore)}
              </AnnotationScoreText>
            </Text>
          )}
          {hasUnscoredLabel ? (
            <div className="evaluator-distributions__legend-item">
              <ColorSwatch color={NEUTRAL_LABEL_COLOR} size="M" />
              <Text size="XS" color="text-700">
                No score
              </Text>
            </div>
          ) : null}
        </div>
      </Flex>
    </section>
  );
}
