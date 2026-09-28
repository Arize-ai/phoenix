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
import type { EvaluatorOptimizationDirection } from "@phoenix/types/evaluators";
import {
  formatFloat,
  formatInt,
  intShortFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type { ProjectEvaluatorCompareDistributions_comparison$key } from "./__generated__/ProjectEvaluatorCompareDistributions_comparison.graphql";
import type { ProjectEvaluatorCompareDistributions_evaluator$key } from "./__generated__/ProjectEvaluatorCompareDistributions_evaluator.graphql";
import type { ProjectEvaluatorCompareDistributions_side$key } from "./__generated__/ProjectEvaluatorCompareDistributions_side.graphql";
import {
  EVALUATOR_COMPARE_COLORS,
  EVALUATOR_COMPARE_HUES,
  type EvaluatorCompareHue,
  getLabelOptimalityColor,
  getPositionalOptimalities,
  NEUTRAL_LABEL_COLOR,
} from "./projectEvaluatorCompareUtils";
import {
  COMPARE_CHART_MARGIN,
  compareChartFooterCSS,
  compareChartToolbarCSS,
  ProjectEvaluatorCompareViewToggle,
} from "./ProjectEvaluatorCompareViewToggle";
import {
  formatScoreValue,
  getDistributionRows,
  getDistributionScope,
  getDistributionThresholdPosition,
  getScoreRowOptimalities,
  orderLabelRowsByOptimality,
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

// Reads as the card's subtitle: subtitle color and size, and no inset, so the
// text lines up where a plain subtitle would sit.
const scopePickerTriggerCSS = css`
  color: var(--global-text-color-700);
  font-size: var(--global-font-size-s);
  padding-inline: var(--global-dimension-size-50);
  margin-inline-start: calc(-1 * var(--global-dimension-size-50));
  &[data-hovered] {
    color: var(--global-text-color-900);
  }
  /* Menu close returns focus to the trigger; no ring for pointer users */
  &[data-focused]:not([data-focus-visible]) {
    outline: none;
  }
`;

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
  const sides = [
    {
      side: sideA,
      id: evaluatorA.id,
      name: evaluatorA.name,
      color: EVALUATOR_COMPARE_COLORS.a,
      hue: EVALUATOR_COMPARE_HUES.a,
      direction:
        evaluatorA.evaluator.outputConfigs[0]?.optimizationDirection ?? null,
      referenceScores: getConfiguredScores(
        evaluatorA.evaluator.outputConfigs[0]
      ),
      optimizationConfig: toAnnotationOptimizationConfig(
        evaluatorA.evaluator.outputConfigs[0] ?? {}
      ),
    },
    {
      side: sideB,
      id: evaluatorB.id,
      name: evaluatorB.name,
      color: EVALUATOR_COMPARE_COLORS.b,
      hue: EVALUATOR_COMPARE_HUES.b,
      direction:
        evaluatorB.evaluator.outputConfigs[0]?.optimizationDirection ?? null,
      referenceScores: getConfiguredScores(
        evaluatorB.evaluator.outputConfigs[0]
      ),
      optimizationConfig: toAnnotationOptimizationConfig(
        evaluatorB.evaluator.outputConfigs[0] ?? {}
      ),
    },
  ].map((item) => {
    const { side } = item;
    const param = `distributionView.${item.id}`;
    const view = getDistributionView({
      side,
      requested: searchParams.get(param),
    });
    return {
      ...item,
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
  const hasScores = sides.some(({ view }) => view === "scores");
  const hasLabels = sides.some(({ view }) => view === "labels");
  const title =
    hasScores && hasLabels
      ? "Distributions"
      : hasScores
        ? "Score distributions"
        : "Label distributions";
  const target = formatEvaluationTargetPlural(evaluatorA.evaluationTarget);

  return (
    <div css={panelCSS}>
      <Card
        title={title}
        headerContent={
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
              evaluatedCount={item.side.evaluatedCount}
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

/**
 * The card's subtitle, doubling as a quiet picker for which targets the
 * distributions cover. Reads as a description until hovered, so the choice
 * sits where the population is already named.
 */
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
        variant="quiet"
        css={scopePickerTriggerCSS}
        aria-label={`Distribution population: ${selected?.label}`}
        trailingVisual={<Icon svg={<Icons.ChevronDown />} />}
      >
        {selected?.label}
      </Button>
      <MenuContainer placement="bottom start" minHeight="auto">
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

/**
 * The scores an evaluator's output config pins down: its label scores, or its
 * score bounds. Lets bar shading rank a result on the evaluator's whole scale
 * even when only one value appears in range.
 */
function getConfiguredScores(
  config:
    | {
        readonly values?: ReadonlyArray<{ readonly score: number | null }>;
        readonly lowerBound?: number | null;
        readonly upperBound?: number | null;
      }
    | undefined
): ReadonlyArray<number | null | undefined> {
  if (config == null) return [];
  if (config.values) return config.values.map(({ score }) => score);
  return [config.lowerBound, config.upperBound];
}

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
  color,
  hue,
  view,
  rows: unorderedRows,
  direction,
  referenceScores,
  optimizationConfig,
  evaluatedCount,
  maximum,
  target,
  scope,
  onViewChange,
}: {
  side: DistributionSide;
  name: string;
  color: string;
  hue: EvaluatorCompareHue;
  view: AnnotationMetricsView;
  rows: DistributionChartRow[];
  direction: EvaluatorOptimizationDirection | null;
  /** The evaluator's configured scores, ranking shades on its own scale. */
  referenceScores: ReadonlyArray<number | null | undefined>;
  optimizationConfig: AnnotationOptimizationConfig | undefined;
  evaluatedCount: number;
  maximum: number;
  target: string;
  scope: DistributionScope;
  onViewChange: (view: AnnotationMetricsView) => void;
}) {
  const { rows, optimalities } =
    view === "labels"
      ? orderLabelRowsByOptimality({
          rows: unorderedRows,
          direction,
          referenceScores,
        })
      : {
          rows: unorderedRows,
          optimalities: getScoreRowOptimalities({
            rows: unorderedRows,
            direction,
            referenceScores,
          }),
        };
  // Bars are always shades of the evaluator's hue, ranked by optimization
  // direction when there is one. Without one, labels step through the shades
  // in display order and scores by value, higher scores stronger.
  const shades =
    optimalities ??
    (view === "scores"
      ? getScoreRowOptimalities({
          rows,
          direction: "MAXIMIZE",
          referenceScores,
        })
      : null) ??
    getPositionalOptimalities(rows.length);
  const getFill = (row: DistributionChartRow, index: number) =>
    row.isOther
      ? NEUTRAL_LABEL_COLOR
      : getLabelOptimalityColor({ hue, optimality: shades[index] ?? null });
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
              evaluatedCount === 0
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
                  width={56}
                  label={{
                    value: target.charAt(0).toUpperCase() + target.slice(1),
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 11,
                    fill: "var(--chart-axis-text-color)",
                    style: { textAnchor: "middle" },
                  }}
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
                  fill={color}
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
        {/* The axis name and the side's mean, in the row the time chart
            keeps its legend in; the mean takes the tint scores have
            elsewhere. A gray bar gets one legend item explaining it. */}
        <div
          css={compareChartFooterCSS}
          className="evaluator-distributions__footer"
        >
          <Text color="text-700">
            {view === "scores" ? "Score" : "Label"}
            {meanScore == null ? null : (
              <>
                {" · mean "}
                <AnnotationScoreText
                  positiveOptimization={getPositiveOptimizationFromConfig({
                    config: optimizationConfig,
                    score: meanScore,
                  })}
                >
                  {formatFloat(meanScore)}
                </AnnotationScoreText>
              </>
            )}
          </Text>
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
