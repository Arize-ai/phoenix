import { css } from "@emotion/react";

import {
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { DEGRADED_WAIT_MS } from "@phoenix/pages/project/evaluators/evaluationQueueStatParts";
import { formatLag } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

const lagValueCSS = css`
  white-space: nowrap;
`;

export type ProjectEvaluatorLag = {
  p50Seconds: number;
  p95Seconds: number;
  p99Seconds: number;
};

/**
 * An evaluators table's lag cell: p95 time from queued to result over the
 * evaluations completed in the time range, with p50 and p99 on hover.
 */
export function ProjectEvaluatorLagCell({
  lag,
}: {
  /** Null when nothing completed in the range. */
  lag: ProjectEvaluatorLag | null;
}) {
  if (lag == null) {
    return (
      <Text fontFamily="mono" color="text-700">
        --
      </Text>
    );
  }
  const isLagging = lag.p95Seconds * 1000 > DEGRADED_WAIT_MS;
  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap>
        <Text
          fontFamily="mono"
          color={isLagging ? "warning" : undefined}
          css={lagValueCSS}
        >
          {formatLag(lag.p95Seconds)}
        </Text>
      </TriggerWrap>
      <RichTooltip placement="end">
        <Text size="S">{`p50 ${formatLag(lag.p50Seconds)} · p99 ${formatLag(lag.p99Seconds)}`}</Text>
      </RichTooltip>
    </TooltipTrigger>
  );
}
