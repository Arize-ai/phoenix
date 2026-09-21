import { css } from "@emotion/react";
import { graphql, useFragment } from "react-relay";
import { Pie, PieChart, Sector, type PieSectorShapeProps } from "recharts";

import {
  ColorSwatch,
  Flex,
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@phoenix/components";
import {
  type AnnotationOptimizationConfig,
  getPositiveOptimizationFromConfig,
  toAnnotationOptimizationConfig,
} from "@phoenix/components/annotation";
import {
  ChartPanel,
  ChartPanelStrip,
  ChartTooltipItem,
} from "@phoenix/components/chart";
import type { ProjectEvaluatorCompareStats_comparison$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareStats_comparison.graphql";
import type { ProjectEvaluatorCompareStats_evaluator$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareStats_evaluator.graphql";
import {
  EVALUATOR_COMPARE_COLORS,
  getComparedOutputName,
  getKappaGloss,
} from "@phoenix/pages/project/evaluators/projectEvaluatorCompareUtils";
import {
  StatField,
  StatFieldList,
} from "@phoenix/pages/project/evaluators/projectEvaluatorStatFields";
import { formatEvaluationTargetPlural } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  formatFloat,
  formatInt,
  formatPercent,
} from "@phoenix/utils/numberFormatUtils";

const COMPARE_STATS_HEIGHT_PIXELS = 208;

const stripCSS = css`
  height: ${COMPARE_STATS_HEIGHT_PIXELS}px;

  .chart-panel .chart-panel__title.heading {
    font-size: var(--global-font-size-m);
    line-height: var(--global-line-height-m);
  }
`;

const statValueCSS = css`
  display: flex;
  align-items: baseline;
  gap: var(--global-dimension-size-50);
`;

const sideBySideGridCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-100);
  height: 100%;
`;

const evaluatorNameCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
  min-width: 0;

  .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const evaluatorSummaryCSS = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: var(--global-dimension-size-50);
  min-width: 0;
`;

const evaluatorSummaryHeaderCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--global-dimension-size-50);
  max-width: 100%;
  min-width: 0;
  overflow: hidden;

  .text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const donutTooltipListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  margin: 0;
  padding: 0;
  list-style: none;
`;

const DONUT_SIZE = 104;
const DONUT_INNER_RADIUS = 40;
const DONUT_OUTER_RADIUS = 50;

function DonutSector({ payload, ...props }: PieSectorShapeProps) {
  return <Sector {...props} fill={payload?.color} />;
}

const formatNullableFloat = (value: number | null) =>
  value == null ? "--" : formatFloat(value);
const formatNullableInt = (value: number | null) =>
  value == null ? "--" : formatInt(value);
const formatNullableRate = (value: number | null) =>
  value == null ? "--" : formatPercent(value * 100);

function StatValueWithDetail({
  value,
  detail,
}: {
  value: string;
  detail: string | null;
}) {
  return (
    <div css={statValueCSS}>
      <Text size="S">{value}</Text>
      {detail ? (
        <Text size="S" color="text-700">
          {detail}
        </Text>
      ) : null}
    </div>
  );
}

function FlagRateDonut({
  color,
  populationSize,
  evaluationTargetsPlural,
  flaggedCount,
  flagRate,
}: {
  color: string;
  populationSize: number;
  evaluationTargetsPlural: string;
  flaggedCount: number | null;
  flagRate: number | null;
}) {
  const notFlaggedCount = Math.max(populationSize - (flaggedCount ?? 0), 0);
  const chartData = [
    { name: "flagged", value: flaggedCount ?? 0, color },
    {
      name: "not flagged",
      value: notFlaggedCount,
      color: "var(--global-color-gray-300)",
    },
  ];
  const formattedRate = formatNullableRate(flagRate);
  const formattedCount = formatNullableInt(flaggedCount);
  const hasFlaggedMetrics = flaggedCount != null && flagRate != null;

  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap>
        <div
          role="img"
          aria-label={`${formattedRate}; ${formattedCount} flagged`}
        >
          <PieChart
            width={DONUT_SIZE}
            height={DONUT_SIZE}
            aria-hidden="true"
            accessibilityLayer={false}
          >
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={DONUT_INNER_RADIUS}
              outerRadius={DONUT_OUTER_RADIUS}
              stroke="transparent"
              strokeWidth={0}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              rootTabIndex={-1}
              shape={DonutSector}
            />
            <text
              x="50%"
              y="42%"
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--global-text-color-900)"
              fontFamily="var(--global-font-family-mono)"
              fontSize="var(--global-font-size-s)"
              fontWeight="var(--font-weight-heavy)"
            >
              {formattedRate}
            </text>
            <text
              x="50%"
              y="58%"
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--global-text-color-700)"
              fontFamily="var(--global-font-family-mono)"
              fontSize="var(--global-font-size-xxs)"
            >
              {`${formattedCount} flagged`}
            </text>
          </PieChart>
        </div>
      </TriggerWrap>
      <RichTooltip placement="bottom">
        <View width="size-2400">
          {hasFlaggedMetrics ? (
            <ul css={donutTooltipListCSS}>
              <li>
                <ChartTooltipItem
                  color={color}
                  name="flagged"
                  shape="square"
                  value={`${formattedCount} · ${formattedRate}`}
                />
              </li>
              <li>
                <ChartTooltipItem
                  color="var(--global-color-gray-300)"
                  name="not flagged"
                  shape="square"
                  value={`${formatInt(notFlaggedCount)} · ${formatPercent(
                    (1 - flagRate) * 100
                  )}`}
                />
              </li>
            </ul>
          ) : (
            <Flex direction="column" gap="size-50">
              <ChartTooltipItem
                color="var(--global-color-gray-300)"
                name={`shared ${evaluationTargetsPlural}`}
                shape="square"
                value={formatInt(populationSize)}
              />
              <Text color="text-700" size="S">
                No optimization direction
              </Text>
            </Flex>
          )}
        </View>
      </RichTooltip>
    </TooltipTrigger>
  );
}

function getMeanScoreColor({
  meanScore,
  optimizationConfig,
}: {
  meanScore: number | null;
  optimizationConfig: AnnotationOptimizationConfig | undefined;
}): "success" | "danger" | undefined {
  const positiveOptimization = getPositiveOptimizationFromConfig({
    config: optimizationConfig,
    score: meanScore,
  });
  return positiveOptimization == null
    ? undefined
    : positiveOptimization
      ? "success"
      : "danger";
}

function EvaluatorSummary({
  name,
  annotationName,
  color,
  populationSize,
  evaluationTargetsPlural,
  flaggedCount,
  flagRate,
  meanScore,
  optimizationConfig,
}: {
  name: string;
  annotationName: string;
  color: string;
  populationSize: number;
  evaluationTargetsPlural: string;
  flaggedCount: number | null;
  flagRate: number | null;
  meanScore: number | null;
  optimizationConfig: AnnotationOptimizationConfig | undefined;
}) {
  const outputName = getComparedOutputName({
    evaluatorName: name,
    annotationName,
  });
  const displayName = outputName ? `${name} · ${outputName}` : name;
  return (
    <section css={evaluatorSummaryCSS}>
      <div css={evaluatorSummaryHeaderCSS}>
        <ColorSwatch color={color} size="M" />
        <Text size="XS" fontFamily="mono" title={displayName}>
          {displayName}
        </Text>
      </div>
      <FlagRateDonut
        color={color}
        populationSize={populationSize}
        evaluationTargetsPlural={evaluationTargetsPlural}
        flaggedCount={flaggedCount}
        flagRate={flagRate}
      />
      <Text
        size="M"
        fontFamily="mono"
        color={getMeanScoreColor({
          meanScore,
          optimizationConfig,
        })}
      >
        <span aria-label="mean score">μ</span>&nbsp;
        {formatNullableFloat(meanScore)}
      </Text>
    </section>
  );
}

const evaluatorFragment = graphql`
  fragment ProjectEvaluatorCompareStats_evaluator on ProjectEvaluator {
    name
    evaluator {
      outputConfigs {
        ... on AnnotationConfigBase {
          name
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

export function ProjectEvaluatorCompareStats({
  comparisonRef,
  evaluatorARef,
  evaluatorBRef,
}: {
  comparisonRef: ProjectEvaluatorCompareStats_comparison$key;
  evaluatorARef: ProjectEvaluatorCompareStats_evaluator$key;
  evaluatorBRef: ProjectEvaluatorCompareStats_evaluator$key;
}) {
  const evaluatorA = useFragment(evaluatorFragment, evaluatorARef);
  const evaluatorB = useFragment(evaluatorFragment, evaluatorBRef);
  const evaluatorAOptimizationConfig = toAnnotationOptimizationConfig(
    evaluatorA.evaluator.outputConfigs[0] ?? {}
  );
  const evaluatorBOptimizationConfig = toAnnotationOptimizationConfig(
    evaluatorB.evaluator.outputConfigs[0] ?? {}
  );
  const comparison = useFragment(
    graphql`
      fragment ProjectEvaluatorCompareStats_comparison on ProjectEvaluatorComparison {
        evaluationTarget
        coverage {
          evaluatedByBoth
          onlyA
          onlyB
          totalInRange
        }
        populationSize
        a {
          annotationName
          flaggedCount
          flagRate
          meanScore
        }
        b {
          annotationName
          flaggedCount
          flagRate
          meanScore
        }
        statistics {
          agreement
          cohensKappa
          spearmanRho
          disagreementCount
        }
      }
    `,
    comparisonRef
  );
  const { coverage, statistics } = comparison;
  const evaluationTargetsPlural = formatEvaluationTargetPlural(
    comparison.evaluationTarget
  );
  const kappaGloss = getKappaGloss(statistics.cohensKappa);
  const evaluatedByBothShareOfRange =
    coverage.totalInRange === 0
      ? null
      : coverage.evaluatedByBoth / coverage.totalInRange;
  const onlyAShareOfRange =
    coverage.totalInRange === 0 ? null : coverage.onlyA / coverage.totalInRange;
  const onlyBShareOfRange =
    coverage.totalInRange === 0 ? null : coverage.onlyB / coverage.totalInRange;
  const disagreementShare =
    statistics.disagreementCount == null || comparison.populationSize === 0
      ? null
      : statistics.disagreementCount / comparison.populationSize;

  return (
    <div css={stripCSS}>
      <ChartPanelStrip chartCount={3}>
        <ChartPanel title="Agreement" headingLevel={3} fillHeight>
          <StatFieldList>
            <StatField label="agreement">
              <Text size="S">
                {statistics.agreement == null
                  ? "--"
                  : formatPercent(statistics.agreement * 100)}
              </Text>
            </StatField>
            <StatField label="Cohen's κ">
              <StatValueWithDetail
                value={formatNullableFloat(statistics.cohensKappa)}
                detail={kappaGloss}
              />
            </StatField>
            <StatField label="score correlation (ρ)">
              <Text size="S">
                {formatNullableFloat(statistics.spearmanRho)}
              </Text>
            </StatField>
            <StatField label="disagreements">
              <StatValueWithDetail
                value={formatNullableInt(statistics.disagreementCount)}
                detail={
                  statistics.disagreementCount == null
                    ? null
                    : formatNullableRate(disagreementShare)
                }
              />
            </StatField>
          </StatFieldList>
        </ChartPanel>
        <ChartPanel title="Coverage" headingLevel={3} fillHeight>
          <StatFieldList fillHeight={false}>
            <StatField label="evaluated by both">
              <StatValueWithDetail
                value={formatInt(coverage.evaluatedByBoth)}
                detail={
                  evaluatedByBothShareOfRange == null
                    ? null
                    : formatNullableRate(evaluatedByBothShareOfRange)
                }
              />
            </StatField>
            <StatField label={`${evaluationTargetsPlural} in range`}>
              <Text size="S">{formatInt(coverage.totalInRange)}</Text>
            </StatField>
            <StatField
              label={
                <div css={evaluatorNameCSS}>
                  <ColorSwatch color={EVALUATOR_COMPARE_COLORS.a} size="M" />
                  <Text size="XS" color="text-700" title={evaluatorA.name}>
                    only {evaluatorA.name}
                  </Text>
                </div>
              }
            >
              <StatValueWithDetail
                value={formatInt(coverage.onlyA)}
                detail={
                  onlyAShareOfRange == null
                    ? null
                    : formatNullableRate(onlyAShareOfRange)
                }
              />
            </StatField>
            <StatField
              label={
                <div css={evaluatorNameCSS}>
                  <ColorSwatch color={EVALUATOR_COMPARE_COLORS.b} size="M" />
                  <Text size="XS" color="text-700" title={evaluatorB.name}>
                    only {evaluatorB.name}
                  </Text>
                </div>
              }
            >
              <StatValueWithDetail
                value={formatInt(coverage.onlyB)}
                detail={
                  onlyBShareOfRange == null
                    ? null
                    : formatNullableRate(onlyBShareOfRange)
                }
              />
            </StatField>
          </StatFieldList>
        </ChartPanel>
        <ChartPanel
          title="Side by side"
          actions={
            <Text size="S" color="text-700">
              {formatInt(comparison.populationSize)} shared{" "}
              {evaluationTargetsPlural}
            </Text>
          }
          headingLevel={3}
          fillHeight
        >
          <div css={sideBySideGridCSS}>
            <EvaluatorSummary
              name={evaluatorA.name}
              annotationName={comparison.a.annotationName}
              color={EVALUATOR_COMPARE_COLORS.a}
              populationSize={comparison.populationSize}
              evaluationTargetsPlural={evaluationTargetsPlural}
              flaggedCount={comparison.a.flaggedCount}
              flagRate={comparison.a.flagRate}
              meanScore={comparison.a.meanScore}
              optimizationConfig={evaluatorAOptimizationConfig}
            />
            <EvaluatorSummary
              name={evaluatorB.name}
              annotationName={comparison.b.annotationName}
              color={EVALUATOR_COMPARE_COLORS.b}
              populationSize={comparison.populationSize}
              evaluationTargetsPlural={evaluationTargetsPlural}
              flaggedCount={comparison.b.flaggedCount}
              flagRate={comparison.b.flagRate}
              meanScore={comparison.b.meanScore}
              optimizationConfig={evaluatorBOptimizationConfig}
            />
          </div>
        </ChartPanel>
      </ChartPanelStrip>
    </div>
  );
}
