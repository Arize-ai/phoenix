import { css } from "@emotion/react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Flex, Heading, Text } from "@phoenix/components";
import type { ProjectEvaluatorScopeDetails_projectEvaluator$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopeDetails_projectEvaluator.graphql";
import {
  formatEvaluationTarget,
  formatSamplingRate,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

const sectionCardCSS = css`
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-size-200);
  margin-top: var(--global-dimension-size-50);
  border: 1px solid var(--global-border-color-default);
  overflow: hidden;
`;

/**
 * Read-only view of the policy a project evaluator runs under: what it
 * targets, which spans it matches, how many of them it samples, and whether
 * it is currently running at all.
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
        enabled
      }
    `,
    projectEvaluatorRef
  );

  return (
    <Flex direction="column" gap="size-100">
      <Heading level={2}>Scope</Heading>
      <div css={sectionCardCSS}>
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
              "All spans"
            )}
          </Text>
          <Text size="S">
            <Text weight="heavy">Sampling Rate:</Text>{" "}
            {formatSamplingRate(projectEvaluator.samplingRate)}
          </Text>
          <Text size="S">
            <Text weight="heavy">Enabled:</Text>{" "}
            {projectEvaluator.enabled ? "Yes" : "No"}
          </Text>
        </Flex>
      </div>
    </Flex>
  );
}
