import { css } from "@emotion/react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Card, Text } from "@phoenix/components";
import {
  EvaluatorDetailList,
  EvaluatorDetailRow,
} from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import type { ProjectEvaluatorScopeDetails_projectEvaluator$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopeDetails_projectEvaluator.graphql";
import {
  formatEvaluationDelay,
  formatEvaluationTarget,
  formatEvaluationTargetPlural,
  formatSamplingRate,
  hasEvaluationDelay,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/**
 * A filter expression is one long unbreakable mono token more often than not
 * (quoted IDs, bracketed attribute paths), and the Scope card lives in a
 * ~300px aside — let it wrap anywhere rather than paint over the row label.
 */
const filterValueCSS = css`
  min-width: 0;
  overflow-wrap: anywhere;
`;

export function ProjectEvaluatorScopeDetails({
  projectEvaluatorRef,
}: {
  projectEvaluatorRef: ProjectEvaluatorScopeDetails_projectEvaluator$key;
}) {
  const projectEvaluator = useFragment(
    graphql`
      fragment ProjectEvaluatorScopeDetails_projectEvaluator on ProjectEvaluator {
        evaluationTarget
        filterCondition
        samplingRate
        evaluationDelaySeconds
      }
    `,
    projectEvaluatorRef
  );
  const isDelayedTarget = hasEvaluationDelay(projectEvaluator.evaluationTarget);

  return (
    <Card title="Scope">
      <EvaluatorDetailList>
        <EvaluatorDetailRow label="Target">
          <Text size="S">
            {formatEvaluationTarget(projectEvaluator.evaluationTarget)}
          </Text>
        </EvaluatorDetailRow>
        <EvaluatorDetailRow label="Filter">
          {projectEvaluator.filterCondition ? (
            <div css={filterValueCSS}>
              <Text size="S" fontFamily="mono">
                {projectEvaluator.filterCondition}
              </Text>
            </div>
          ) : (
            <Text size="S">
              {`All ${formatEvaluationTargetPlural(projectEvaluator.evaluationTarget)}`}
            </Text>
          )}
        </EvaluatorDetailRow>
        <EvaluatorDetailRow label="Sampling rate">
          <Text size="S">
            {formatSamplingRate(projectEvaluator.samplingRate)}
          </Text>
        </EvaluatorDetailRow>
        {isDelayedTarget ? (
          <EvaluatorDetailRow label="Evaluation delay">
            <Text size="S">
              {formatEvaluationDelay(projectEvaluator.evaluationDelaySeconds)}
            </Text>
          </EvaluatorDetailRow>
        ) : null}
      </EvaluatorDetailList>
    </Card>
  );
}
