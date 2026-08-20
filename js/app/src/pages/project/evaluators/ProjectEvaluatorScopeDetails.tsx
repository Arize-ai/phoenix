import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Alert, Card, Flex, Text, View } from "@phoenix/components";
import { Token } from "@phoenix/components/core/token";
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
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          <EvaluatorDetailList>
            <EvaluatorDetailRow label="Target">
              <Token>
                {formatEvaluationTarget(projectEvaluator.evaluationTarget)}
              </Token>
            </EvaluatorDetailRow>
            <EvaluatorDetailRow label="Filter">
              {projectEvaluator.filterCondition ? (
                <Text size="S" fontFamily="mono">
                  {projectEvaluator.filterCondition}
                </Text>
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
                  {formatEvaluationDelay(
                    projectEvaluator.evaluationDelaySeconds
                  )}
                </Text>
              </EvaluatorDetailRow>
            ) : null}
          </EvaluatorDetailList>
          {projectEvaluator.schedulabilityStatus === "NOT_SCHEDULABLE" ? (
            <Alert variant="warning" title="This evaluator is not scheduled">
              {getSchedulabilityExplanation(
                projectEvaluator.schedulabilityReason
              )}
            </Alert>
          ) : null}
        </Flex>
      </View>
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
