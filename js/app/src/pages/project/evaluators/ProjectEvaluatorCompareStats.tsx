import { css } from "@emotion/react";
import { graphql, useFragment } from "react-relay";

import { ColorSwatch, Text, View } from "@phoenix/components";
import {
  CHART_PANEL_STRIP_DEFAULT_HEIGHT_PIXELS,
  ChartPanel,
  ChartPanelStrip,
} from "@phoenix/components/chart";
import type { ProjectEvaluatorCompareStats_comparison$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareStats_comparison.graphql";
import {
  EVALUATOR_COMPARE_COLORS,
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
  height: ${CHART_PANEL_STRIP_DEFAULT_HEIGHT_PIXELS}px;
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
  color,
  flaggedCount,
  flagRate,
  meanScore,
}: {
  name: string;
  color: string;
  flaggedCount: number | null;
  flagRate: number | null;
  meanScore: number | null;
}) {
  return (
    <>
      <div css={evaluatorNameCSS}>
        <ColorSwatch color={color} size="M" />
        <Text size="S" title={name}>
          {name}
        </Text>
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
          flaggedCount
          flagRate
          meanScore
        }
        sideB {
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
  const disagreementShare =
    statistics.disagreementCount == null || coverage.evaluatedByBoth === 0
      ? null
      : statistics.disagreementCount / coverage.evaluatedByBoth;

  return (
    <div css={stripCSS}>
      <ChartPanelStrip chartCount={3}>
        <ChartPanel
          title="Agreement"
          subtitle="Do the two evaluators reach the same verdict?"
          fillHeight
        >
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
        <ChartPanel
          title="Coverage"
          subtitle="The population this page is computed over"
          fillHeight
        >
          <StatFieldList fillHeight={false}>
            <StatField label="evaluated by both">
              <Text size="S">{formatInt(coverage.evaluatedByBoth)}</Text>
            </StatField>
            <StatField
              label={`${formatEvaluationTargetPlural(
                comparison.evaluationTarget
              )} in range`}
            >
              <Text size="S">{formatInt(coverage.totalInRange)}</Text>
            </StatField>
            <StatField label={`only ${evaluatorAName}`}>
              <Text size="S">{formatInt(coverage.onlyA)}</Text>
            </StatField>
            <StatField label={`only ${evaluatorBName}`}>
              <Text size="S">{formatInt(coverage.onlyB)}</Text>
            </StatField>
          </StatFieldList>
          <View paddingTop="size-200">
            <Text size="XS" color="text-700">
              Every panel below uses the {formatInt(coverage.evaluatedByBoth)}{" "}
              {formatEvaluationTargetPlural(comparison.evaluationTarget)}{" "}
              evaluated by both.
            </Text>
          </View>
        </ChartPanel>
        <ChartPanel
          title="Side by side"
          subtitle={`Each evaluator over the shared ${formatEvaluationTargetPlural(
            comparison.evaluationTarget
          )}`}
          fillHeight
        >
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
              color={EVALUATOR_COMPARE_COLORS.a}
              flaggedCount={comparison.sideA.flaggedCount}
              flagRate={comparison.sideA.flagRate}
              meanScore={comparison.sideA.meanScore}
            />
            <SideBySideRow
              name={evaluatorBName}
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
