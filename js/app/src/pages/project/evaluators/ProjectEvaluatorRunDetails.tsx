import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Flex, Heading, Text } from "@phoenix/components";
import { Token } from "@phoenix/components/core/token";
import { evaluatorDetailsCardCSS } from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import type { ProjectEvaluatorRunDetails_projectEvaluator$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorRunDetails_projectEvaluator.graphql";
import {
  formatLastRun,
  getProjectEvaluatorStatus,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/**
 * What this evaluator has actually done lately: the status the table reports,
 * the funnel behind it, and the last error it hit. Counts cover recent activity
 * only — completed evaluations are not kept forever.
 */
export function ProjectEvaluatorRunDetails({
  projectEvaluatorRef,
}: {
  projectEvaluatorRef: ProjectEvaluatorRunDetails_projectEvaluator$key;
}) {
  const projectEvaluator = useFragment(
    graphql`
      fragment ProjectEvaluatorRunDetails_projectEvaluator on ProjectEvaluator {
        schedulabilityStatus
        schedulabilityReason
        runSummary {
          status
          lastRunAt
          queuedCount
          evaluatedCount
          failedCount
          lastError
        }
      }
    `,
    projectEvaluatorRef
  );
  const { runSummary } = projectEvaluator;
  const status = getProjectEvaluatorStatus({
    schedulabilityStatus: projectEvaluator.schedulabilityStatus,
    schedulabilityReason: projectEvaluator.schedulabilityReason,
    runSummary,
  });

  return (
    <Flex direction="column" gap="size-100">
      <Heading level={2}>Recent activity</Heading>
      <div css={evaluatorDetailsCardCSS}>
        <Flex direction="column" gap="size-100">
          <Flex direction="row" gap="size-100" alignItems="center">
            <Token color={status.color}>{status.label}</Token>
            <Text size="S" color="text-700">
              {status.explanation}
            </Text>
          </Flex>
          <Text size="S">
            <Text weight="heavy">Last run:</Text>{" "}
            {formatLastRun(runSummary.lastRunAt)}
          </Text>
          <Text size="S">
            <Text weight="heavy">Evaluated:</Text> {runSummary.evaluatedCount}
          </Text>
          <Text size="S">
            <Text weight="heavy">Failed:</Text> {runSummary.failedCount}
          </Text>
          <Text size="S">
            <Text weight="heavy">Queued:</Text> {runSummary.queuedCount}
          </Text>
          {runSummary.lastError ? (
            <Text size="S">
              <Text weight="heavy">Last error:</Text>{" "}
              <Text size="S" fontFamily="mono">
                {runSummary.lastError}
              </Text>
            </Text>
          ) : null}
        </Flex>
      </div>
    </Flex>
  );
}
