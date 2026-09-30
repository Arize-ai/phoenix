import { css } from "@emotion/react";
import { graphql, useFragment } from "react-relay";

import { Card, ColorSwatch, Text, View } from "@phoenix/components";
import type { ProjectEvaluatorCompareStats_comparison$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareStats_comparison.graphql";
import type {
  ProjectEvaluatorCompareStats_evaluator$data,
  ProjectEvaluatorCompareStats_evaluator$key,
} from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorCompareStats_evaluator.graphql";
import {
  EVALUATOR_COMPARE_COLORS,
  formatFlagCondition,
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
    evaluator {
      outputConfigs {
        ... on CategoricalAnnotationConfig {
          optimizationDirection
        }
        ... on ContinuousAnnotationConfig {
          optimizationDirection
        }
        ... on FreeformAnnotationConfig {
          optimizationDirection
        }
      }
    }
  }
`;

/** Paragraphs for a stat's info tip. */
function StatHelp({ children }: { children: ReadonlyArray<string | null> }) {
  return (
    <>
      {children
        .filter((line): line is string => line != null)
        .map((line) => (
          <Text key={line} size="S">
            {line}
          </Text>
        ))}
    </>
  );
}

/** The flag rule each thresholded side reduces its scores with. */
function formatFlagRules(
  sides: ReadonlyArray<{
    evaluator: ProjectEvaluatorCompareStats_evaluator$data;
    threshold: number | null;
  }>
): string | null {
  const rules = sides.flatMap(({ evaluator, threshold }) =>
    threshold == null
      ? []
      : [
          `${evaluator.name} ${formatFlagCondition({
            threshold,
            optimizationDirection:
              evaluator.evaluator.outputConfigs[0]?.optimizationDirection ??
              null,
          })}`,
        ]
  );
  return rules.length === 0 ? null : `Flagged at ${rules.join(", ")}`;
}

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
        a {
          threshold
        }
        b {
          threshold
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
  const capitalizedTargets =
    evaluationTargetsPlural.charAt(0).toUpperCase() +
    evaluationTargetsPlural.slice(1);
  const flagRules = formatFlagRules([
    { evaluator: evaluatorA, threshold: comparison.a.threshold },
    { evaluator: evaluatorB, threshold: comparison.b.threshold },
  ]);
  const disagreementShare =
    statistics.disagreementCount == null || comparison.populationSize === 0
      ? null
      : statistics.disagreementCount / comparison.populationSize;

  return (
    <div css={statsGridCSS}>
      <Card
        title="Agreement"
        titleSeparator={false}
        extra={
          <Text size="S" color="text-700">
            {`${formatInt(comparison.populationSize)} ${evaluationTargetsPlural} evaluated by both`}
          </Text>
        }
      >
        <View paddingX="size-200" paddingBottom="size-200">
          <StatFieldList fillHeight={false}>
            <StatField
              label="agreement"
              help={
                <StatHelp>
                  {[
                    "How often both evaluators reach the same verdict: both flagged, both not, or the same label.",
                    flagRules,
                  ]}
                </StatHelp>
              }
            >
              <Text size="S">
                {statistics.agreement == null
                  ? "--"
                  : formatPercent(statistics.agreement * 100)}
              </Text>
            </StatField>
            <StatField
              label="Cohen's κ"
              help={
                <StatHelp>
                  {[
                    "Agreement adjusted for chance.",
                    "1 = perfect · 0 = chance · < 0 = worse",
                  ]}
                </StatHelp>
              }
            >
              <StatValueWithDetail
                value={formatNullableFloat(statistics.cohensKappa)}
                detail={kappaGloss}
              />
            </StatField>
            <StatField
              label="score correlation (ρ)"
              help={
                <StatHelp>
                  {[
                    "Do the raw scores rank results the same way?",
                    "1 = same order · 0 = unrelated · −1 = reversed",
                    "Needs continuous scores from both.",
                  ]}
                </StatHelp>
              }
            >
              <Text size="S">
                {formatNullableFloat(statistics.spearmanRho)}
              </Text>
            </StatField>
            <StatField
              label="disagreements"
              help={
                <StatHelp>
                  {[`${capitalizedTargets} where the verdicts differ.`]}
                </StatHelp>
              }
            >
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
            <StatField
              label="evaluated by both"
              help={
                <StatHelp>
                  {[
                    `${capitalizedTargets} with a result from both evaluators.`,
                  ]}
                </StatHelp>
              }
            >
              <Text size="S">{formatInt(coverage.evaluatedByBoth)}</Text>
            </StatField>
            <StatField
              label={`${evaluationTargetsPlural} in range`}
              help={
                <StatHelp>
                  {[
                    `All ${evaluationTargetsPlural} in the time range, evaluated or not.`,
                  ]}
                </StatHelp>
              }
            >
              <Text size="S">{formatInt(coverage.totalInRange)}</Text>
            </StatField>
            <StatField
              help={
                <StatHelp>
                  {[
                    `${capitalizedTargets} with a result from ${evaluatorA.name} only.`,
                  ]}
                </StatHelp>
              }
              label={
                <div css={evaluatorNameCSS}>
                  <ColorSwatch color={EVALUATOR_COMPARE_COLORS.a} size="M" />
                  <Text size="XS" color="text-700" title={evaluatorA.name}>
                    only {evaluatorA.name}
                  </Text>
                </div>
              }
            >
              <Text size="S">{formatInt(coverage.onlyA)}</Text>
            </StatField>
            <StatField
              help={
                <StatHelp>
                  {[
                    `${capitalizedTargets} with a result from ${evaluatorB.name} only.`,
                  ]}
                </StatHelp>
              }
              label={
                <div css={evaluatorNameCSS}>
                  <ColorSwatch color={EVALUATOR_COMPARE_COLORS.b} size="M" />
                  <Text size="XS" color="text-700" title={evaluatorB.name}>
                    only {evaluatorB.name}
                  </Text>
                </div>
              }
            >
              <Text size="S">{formatInt(coverage.onlyB)}</Text>
            </StatField>
          </StatFieldList>
        </View>
      </Card>
    </div>
  );
}
