import { css } from "@emotion/react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Alert, Card, Text, View } from "@phoenix/components";
import {
  EvaluatorDetailList,
  EvaluatorDetailRow,
} from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import type {
  ProjectEvaluatorScopeDetails_projectEvaluator$data,
  ProjectEvaluatorScopeDetails_projectEvaluator$key,
} from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopeDetails_projectEvaluator.graphql";
import {
  formatEvaluationDelay,
  formatEvaluationTarget,
  formatEvaluationTargetPlural,
  formatSamplingRate,
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

/**
 * Read-only view of the policy a project evaluator runs under: what it
 * targets, which spans it matches, and how many of them it samples. Whether
 * the evaluator runs at all is the page header's enabled switch.
 */
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
        schedulabilityStatus
        schedulabilityReason
      }
    `,
    projectEvaluatorRef
  );
  const isSessionTarget = projectEvaluator.evaluationTarget === "SESSION";

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
        {isSessionTarget ? (
          <EvaluatorDetailRow label="Evaluation delay">
            <Text size="S">
              {formatEvaluationDelay(projectEvaluator.evaluationDelaySeconds)}
            </Text>
          </EvaluatorDetailRow>
        ) : null}
      </EvaluatorDetailList>
      {projectEvaluator.schedulabilityStatus === "NOT_SCHEDULABLE" ? (
        <View
          paddingX="size-200"
          paddingBottom="size-200"
          paddingTop="size-100"
        >
          <Alert variant="warning" title="This evaluator is not scheduled">
            {getSchedulabilityExplanation(
              projectEvaluator.schedulabilityReason
            )}
          </Alert>
        </View>
      ) : null}
    </Card>
  );
}

/** Every reason the server can report, including ones this build predates. */
function getSchedulabilityExplanation(
  reason: ProjectEvaluatorScopeDetails_projectEvaluator$data["schedulabilityReason"]
): string {
  switch (reason) {
    case "DISABLED":
      return "Enable this evaluator to resume scheduling.";
    case "TRACE_TARGET_UNSUPPORTED":
      return "Trace evaluators are not scheduled yet.";
    default:
      return "This evaluator does not meet the scheduling requirements.";
  }
}
