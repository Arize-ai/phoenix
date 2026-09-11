import { css } from "@emotion/react";
import { graphql, useFragment } from "react-relay";

import { ColorSwatch, Flex, Text } from "@phoenix/components";
import { ChartPanel, ChartPanelStrip } from "@phoenix/components/chart";
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

const stripCSS = css`
  height: var(--global-dimension-size-2400);

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
  grid-template-columns: minmax(0, 1fr) repeat(3, max-content);
  align-items: center;
  column-gap: var(--global-dimension-size-200);
  row-gap: var(--global-dimension-size-150);
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

const sideMetricCSS = css`
  text-align: right;
`;

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

function SideBySideRow({
  name,
  annotationName,
  color,
  flaggedCount,
  flagRate,
  meanScore,
}: {
  name: string;
  annotationName: string;
  color: string;
  flaggedCount: number | null;
  flagRate: number | null;
  meanScore: number | null;
}) {
  const outputName = getComparedOutputName({
    evaluatorName: name,
    annotationName,
  });
  return (
    <>
      <div css={evaluatorNameCSS}>
        <ColorSwatch color={color} size="M" />
        <Flex direction="column" minWidth={0}>
          <Text size="S" title={name}>
            {name}
          </Text>
          {outputName ? (
            <Text size="XS" color="text-700" title={annotationName}>
              output: {outputName}
            </Text>
          ) : null}
        </Flex>
      </div>
      <Text size="S" css={sideMetricCSS}>
        {formatNullableInt(flaggedCount)}
      </Text>
      <Text size="S" css={sideMetricCSS}>
        {formatNullableRate(flagRate)}
      </Text>
      <Text size="S" css={sideMetricCSS}>
        {formatNullableFloat(meanScore)}
      </Text>
    </>
  );
}

export function ProjectEvaluatorCompareStats({
  comparisonRef,
  evaluatorAName,
  evaluatorBName,
}: {
  comparisonRef: ProjectEvaluatorCompareStats_comparison$key;
  evaluatorAName: string;
  evaluatorBName: string;
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
            <StatField
              label={`${formatEvaluationTargetPlural(
                comparison.evaluationTarget
              )} in range`}
            >
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
        <ChartPanel title="Side by side" headingLevel={3} fillHeight>
          <div css={sideBySideGridCSS}>
            <Text size="XS" color="text-700">
              evaluator
            </Text>
            <Text size="XS" color="text-700" css={sideMetricCSS}>
              flagged
            </Text>
            <Text size="XS" color="text-700" css={sideMetricCSS}>
              flag rate
            </Text>
            <Text size="XS" color="text-700" css={sideMetricCSS}>
              mean score
            </Text>
            <SideBySideRow
              name={evaluatorAName}
              annotationName={comparison.sideA.annotationName}
              color={EVALUATOR_COMPARE_COLORS.a}
              flaggedCount={comparison.sideA.flaggedCount}
              flagRate={comparison.sideA.flagRate}
              meanScore={comparison.sideA.meanScore}
            />
            <SideBySideRow
              name={evaluatorBName}
              annotationName={comparison.sideB.annotationName}
              color={EVALUATOR_COMPARE_COLORS.b}
              flaggedCount={comparison.sideB.flaggedCount}
              flagRate={comparison.sideB.flagRate}
              meanScore={comparison.sideB.meanScore}
            />
          </div>
        </ChartPanel>
      </ChartPanelStrip>
    </div>
  );
}
