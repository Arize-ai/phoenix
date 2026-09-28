import { css } from "@emotion/react";
import { graphql, useFragment } from "react-relay";

import { Card, ColorSwatch, Text, View } from "@phoenix/components";
import type { ProjectEvaluatorCompareStats_comparison$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareStats_comparison.graphql";
import type { ProjectEvaluatorCompareStats_evaluator$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareStats_evaluator.graphql";
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

const statsGridCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-200);
  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const statValueCSS = css`
  display: flex;
  align-items: baseline;
  gap: var(--global-dimension-size-50);
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

const evaluatorFragment = graphql`
  fragment ProjectEvaluatorCompareStats_evaluator on ProjectEvaluator {
    name
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
    <div css={statsGridCSS}>
      <Card title="Agreement" titleSeparator={false}>
        <View paddingX="size-200" paddingBottom="size-200">
          <StatFieldList fillHeight={false}>
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
        </View>
      </Card>
      <Card title="Coverage" titleSeparator={false}>
        <View paddingX="size-200" paddingBottom="size-200">
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
        </View>
      </Card>
    </div>
  );
}
