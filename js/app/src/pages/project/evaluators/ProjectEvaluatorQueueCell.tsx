import { formatDistanceToNowStrict } from "date-fns";

import {
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { formatElapsedShort } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

export type ProjectEvaluatorQueuedWork = {
  queuedCount: number;
  oldestQueuedAt: string | null;
};

const countFormatter = new Intl.NumberFormat();

/**
 * The evaluators table's queued cell: how many of the evaluator's evaluations
 * are queued and how long the next one has waited.
 */
export function ProjectEvaluatorQueueCell({
  queuedWork,
}: {
  queuedWork: ProjectEvaluatorQueuedWork;
}) {
  const { queuedCount, oldestQueuedAt } = queuedWork;
  if (queuedCount === 0) {
    return (
      <Text fontFamily="mono" color="text-700">
        --
      </Text>
    );
  }
  const count = (
    <Text fontFamily="mono">{countFormatter.format(queuedCount)}</Text>
  );
  // Only running evaluations are queued, so nothing is waiting.
  if (oldestQueuedAt == null) {
    return count;
  }
  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap>
        <Text fontFamily="mono">
          {countFormatter.format(queuedCount)}
          <Text fontFamily="mono" color="text-700">
            {` · ${formatElapsedShort(oldestQueuedAt)}`}
          </Text>
        </Text>
      </TriggerWrap>
      <RichTooltip placement="bottom">
        <Text size="S">{`Next evaluation has waited ${formatDistanceToNowStrict(new Date(oldestQueuedAt), { roundingMethod: "floor" })}`}</Text>
      </RichTooltip>
    </TooltipTrigger>
  );
}
