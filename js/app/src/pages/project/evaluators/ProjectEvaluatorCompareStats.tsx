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
} from "@phoenix/components/annotation";
import {
  ChartPanel,
  ChartPanelStrip,
  ChartTooltipItem,
} from "@phoenix/components/chart";
import type { ProjectEvaluatorCompareStats_comparison$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareStats_comparison.graphql";
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
  evaluatedByBoth,
  evaluationTargetsPlural,
  flaggedCount,
  flagRate,
}: {
  color: string;
  evaluatedByBoth: number;
  evaluationTargetsPlural: string;
  flaggedCount: number | null;
  flagRate: number | null;
}) {
  const notFlaggedCount = Math.max(evaluatedByBoth - (flaggedCount ?? 0), 0);
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
                value={formatInt(evaluatedByBoth)}
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
  evaluatedByBoth,
  evaluationTargetsPlural,
  flaggedCount,
  flagRate,
  meanScore,
  optimizationConfig,
}: {
  name: string;
  annotationName: string;
  color: string;
  evaluatedByBoth: number;
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
        evaluatedByBoth={evaluatedByBoth}
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

export function ProjectEvaluatorCompareStats({
  comparisonRef,
  evaluatorAName,
  evaluatorBName,
  evaluatorAOptimizationConfig,
  evaluatorBOptimizationConfig,
}: {
  comparisonRef: ProjectEvaluatorCompareStats_comparison$key;
  evaluatorAName: string;
  evaluatorBName: string;
  evaluatorAOptimizationConfig: AnnotationOptimizationConfig | undefined;
  evaluatorBOptimizationConfig: AnnotationOptimizationConfig | undefined;
}) {
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
        sideA {
          annotationName
          flaggedCount
          flagRate
          meanScore
        }
        sideB {
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
    statistics.disagreementCount == null || coverage.evaluatedByBoth === 0
      ? null
      : statistics.disagreementCount / coverage.evaluatedByBoth;

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
                  <Text size="XS" color="text-700" title={evaluatorAName}>
                    only {evaluatorAName}
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
                  <Text size="XS" color="text-700" title={evaluatorBName}>
                    only {evaluatorBName}
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
              {formatInt(coverage.evaluatedByBoth)} shared{" "}
              {evaluationTargetsPlural}
            </Text>
          }
          headingLevel={3}
          fillHeight
        >
          <div css={sideBySideGridCSS}>
            <EvaluatorSummary
              name={evaluatorAName}
              annotationName={comparison.sideA.annotationName}
              color={EVALUATOR_COMPARE_COLORS.a}
              evaluatedByBoth={coverage.evaluatedByBoth}
              evaluationTargetsPlural={evaluationTargetsPlural}
              flaggedCount={comparison.sideA.flaggedCount}
              flagRate={comparison.sideA.flagRate}
              meanScore={comparison.sideA.meanScore}
              optimizationConfig={evaluatorAOptimizationConfig}
            />
            <EvaluatorSummary
              name={evaluatorBName}
              annotationName={comparison.sideB.annotationName}
              color={EVALUATOR_COMPARE_COLORS.b}
              evaluatedByBoth={coverage.evaluatedByBoth}
              evaluationTargetsPlural={evaluationTargetsPlural}
              flaggedCount={comparison.sideB.flaggedCount}
              flagRate={comparison.sideB.flagRate}
              meanScore={comparison.sideB.meanScore}
              optimizationConfig={evaluatorBOptimizationConfig}
            />
          </div>
        </ChartPanel>
      </ChartPanelStrip>
    </div>
  );
}
