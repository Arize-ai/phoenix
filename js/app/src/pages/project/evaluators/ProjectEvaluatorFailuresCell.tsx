import { css } from "@emotion/react";

import {
  Flex,
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import type { TextColorValue } from "@phoenix/components/core/types/style";
import { formatLastRun } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { formatPercentShort } from "@phoenix/utils/numberFormatUtils";

export type ProjectEvaluatorFailureSummary = {
  failedCount: number;
  evaluatedCount: number;
  droppedCount: number;
  failureRate: number | null;
  lastFailedAt: string | null;
  lastError: string | null;
};

/**
 * The failure rate at which a row reads as broken rather than flaky. Below it,
 * failures still show but in the neutral text color, so a busy evaluator with
 * a handful of transient errors doesn't compete with one that is failing
 * outright.
 */
const DANGER_FAILURE_RATE = 0.1;

const countFormatter = new Intl.NumberFormat();

const errorCSS = css`
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
`;

function getFailureRateColor(failureRate: number): TextColorValue {
  if (failureRate >= DANGER_FAILURE_RATE) {
    return "danger";
  }
  return failureRate > 0 ? "text-900" : "text-700";
}

/**
 * The evaluators table's failures cell: the share of evaluations that
 * finished in the page time range and were given up on, with the raw counts
 * and the newest error on hover, so a broken evaluator can be told
 * apart from a flaky one — and usually diagnosed — without leaving the list.
 */
export function ProjectEvaluatorFailuresCell({
  failureSummary,
}: {
  failureSummary: ProjectEvaluatorFailureSummary;
}) {
  const {
    failedCount,
    evaluatedCount,
    droppedCount,
    failureRate,
    lastFailedAt,
    lastError,
  } = failureSummary;
  if (failureRate == null) {
    return (
      <Text fontFamily="mono" color="text-700">
        --
      </Text>
    );
  }
  const counts = [
    `${countFormatter.format(failedCount)} failed`,
    `${countFormatter.format(evaluatedCount)} evaluated`,
    ...(droppedCount > 0
      ? [`${countFormatter.format(droppedCount)} dropped`]
      : []),
  ].join(" · ");
  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap>
        <Text fontFamily="mono" color={getFailureRateColor(failureRate)}>
          {formatPercentShort(failureRate * 100)}
        </Text>
      </TriggerWrap>
      <RichTooltip placement="bottom">
        <Flex direction="column" gap="size-100">
          <Text size="S" color="text-700">
            {counts} in this time range
          </Text>
          {lastFailedAt != null ? (
            <Flex direction="column" gap="size-50">
              <Text size="S">{`Last failed ${formatLastRun(lastFailedAt)}`}</Text>
              {lastError ? (
                <div css={errorCSS}>
                  <Text size="XS" fontFamily="mono" color="danger">
                    {lastError}
                  </Text>
                </div>
              ) : null}
            </Flex>
          ) : null}
        </Flex>
      </RichTooltip>
    </TooltipTrigger>
  );
}
