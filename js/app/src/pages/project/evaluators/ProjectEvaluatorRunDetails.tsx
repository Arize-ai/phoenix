import { css } from "@emotion/react";
import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Flex, Text } from "@phoenix/components";
import { Token } from "@phoenix/components/core/token";
import {
  EvaluatorStatRow,
  EvaluatorStatTile,
} from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import type { ProjectEvaluatorRunDetails_projectEvaluator$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorRunDetails_projectEvaluator.graphql";
import {
  formatLastRun,
  formatLastRunTimestamp,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

const lastErrorCSS = css`
  border-radius: var(--global-rounding-medium);
  border: 1px solid var(--global-color-danger);
  background-color: var(
    --global-color-background-optimization-direction-negative
  );
  padding: var(--global-dimension-size-200);
`;

/**
 * What this evaluator has done lately, as four headline numbers plus the last
 * error if it hit one. Counts cover the online-evaluation retention window
 * rather than all time, which the captions say so the numbers are not misread.
 */
export function ProjectEvaluatorRunDetails({
  projectEvaluatorRef,
}: {
  projectEvaluatorRef: ProjectEvaluatorRunDetails_projectEvaluator$key;
}) {
  const projectEvaluator = useFragment(
    graphql`
      fragment ProjectEvaluatorRunDetails_projectEvaluator on ProjectEvaluator {
        evaluationTarget
        runSummary {
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
  const totalRuns = runSummary.evaluatedCount + runSummary.failedCount;
  const failureRate =
    totalRuns > 0
      ? `${((runSummary.failedCount / totalRuns) * 100).toFixed(1)}% of runs`
      : "no runs yet";
  const evaluatedUnit =
    projectEvaluator.evaluationTarget === "SESSION" ? "sessions" : "spans";
  const errorCode =
    runSummary.lastError == null ? null : getErrorCode(runSummary.lastError);

  return (
    <Flex direction="column" gap="size-200">
      <EvaluatorStatRow>
        <EvaluatorStatTile
          label="Last run"
          value={formatLastRun(runSummary.lastRunAt)}
          caption={formatLastRunTimestamp(runSummary.lastRunAt)}
        />
        <EvaluatorStatTile
          label="Evaluated"
          value={runSummary.evaluatedCount}
          caption={`${evaluatedUnit} evaluated recently`}
        />
        <EvaluatorStatTile
          label="Failed"
          value={runSummary.failedCount}
          caption={failureRate}
          tone={runSummary.failedCount > 0 ? "danger" : "default"}
        />
        <EvaluatorStatTile
          label="Queued"
          value={runSummary.queuedCount}
          caption={
            runSummary.queuedCount > 0 ? "waiting to run" : "nothing pending"
          }
        />
      </EvaluatorStatRow>
      {runSummary.lastError ? (
        <div css={lastErrorCSS}>
          <Flex direction="column" gap="size-100">
            <Flex direction="row" gap="size-100" alignItems="center" wrap>
              <Text size="S" weight="heavy">
                Last error
              </Text>
              {errorCode == null ? null : (
                <Token color="var(--global-color-danger)" maxWidth="none">
                  {errorCode}
                </Token>
              )}
            </Flex>
            <Text size="S" color="text-700" fontFamily="mono">
              {getErrorDetail(runSummary.lastError)}
            </Text>
          </Flex>
        </div>
      ) : null}
    </Flex>
  );
}

/**
 * Errors arrive as `CODE: detail`. Splitting them lets the code read as a label
 * and keeps the detail from swallowing it, and an error without a code simply
 * has none to show.
 */
const ERROR_CODE_PATTERN = /^([A-Z][A-Z0-9_]*):\s*(.*)$/s;

function getErrorCode(lastError: string): string | null {
  return ERROR_CODE_PATTERN.exec(lastError)?.[1] ?? null;
}

function getErrorDetail(lastError: string): string {
  return ERROR_CODE_PATTERN.exec(lastError)?.[2] ?? lastError;
}
