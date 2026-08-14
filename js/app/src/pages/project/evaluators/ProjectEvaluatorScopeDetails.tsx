import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Alert, Flex, Heading, Text } from "@phoenix/components";
import { evaluatorDetailsCardCSS } from "@phoenix/components/evaluators/EvaluatorDetailsSection";
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
    <Flex direction="column" gap="size-100">
      <Heading level={2}>Scope</Heading>
      <div css={evaluatorDetailsCardCSS}>
        <Flex direction="column" gap="size-100">
          <Text size="S">
            <Text weight="heavy">Target:</Text>{" "}
            {formatEvaluationTarget(projectEvaluator.evaluationTarget)}
          </Text>
          <Text size="S">
            <Text weight="heavy">Filter:</Text>{" "}
            {projectEvaluator.filterCondition ? (
              <Text size="S" fontFamily="mono">
                {projectEvaluator.filterCondition}
              </Text>
            ) : (
              `All ${formatEvaluationTargetPlural(projectEvaluator.evaluationTarget)}`
            )}
          </Text>
          <Text size="S">
            <Text weight="heavy">Sampling Rate:</Text>{" "}
            {formatSamplingRate(projectEvaluator.samplingRate)}
          </Text>
          {isSessionTarget ? (
            <Text size="S">
              <Text weight="heavy">Evaluation Delay:</Text>{" "}
              {formatEvaluationDelay(projectEvaluator.evaluationDelaySeconds)}
            </Text>
          ) : null}
          {projectEvaluator.schedulabilityStatus === "NOT_SCHEDULABLE" ? (
            <Alert variant="warning" title="This evaluator is not scheduled">
              {getSchedulabilityExplanation(
                projectEvaluator.schedulabilityReason
              )}
            </Alert>
          ) : null}
        </Flex>
      </div>
    </Flex>
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
