import { formatDistanceToNowStrict } from "date-fns";

import {
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import {
  formatElapsedShort,
  formatQueueCount,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

export type ProjectEvaluatorQueuedWork = {
  queuedCount: number;
  oldestQueuedAt: string | null;
};

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
  const formattedCount = formatQueueCount(queuedCount);
  const count = <Text fontFamily="mono">{formattedCount}</Text>;
  // Only running evaluations are queued, so nothing is waiting.
  if (oldestQueuedAt == null) {
    return count;
  }
  return (
    <TooltipTrigger delay={0}>
      <TriggerWrap>
        <Text fontFamily="mono">
          {formattedCount}
          <Text fontFamily="mono" color="text-700">
            {` · ${formatElapsedShort(oldestQueuedAt)}`}
          </Text>
        </Text>
      </TriggerWrap>
      <RichTooltip placement="bottom">
        <Text size="S">{`Oldest has waited ${formatDistanceToNowStrict(new Date(oldestQueuedAt), { roundingMethod: "floor" })}, including retries`}</Text>
      </RichTooltip>
    </TooltipTrigger>
  );
}
