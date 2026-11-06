import { Focusable } from "react-aria";

import { Flex, Text } from "@phoenix/components";
import { Token } from "@phoenix/components/core/token";
import {
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components/core/tooltip";
import {
  formatRelativeOrNever,
  formatRetainedOutcomeCounts,
} from "@phoenix/pages/project/evaluators/projectEvaluatorFormat";
import type { ProjectEvaluatorStatusFields } from "@phoenix/pages/project/evaluators/projectEvaluatorStatus";
import { getProjectEvaluatorStatus } from "@phoenix/pages/project/evaluators/projectEvaluatorStatus";

export function ProjectEvaluatorStatusCell({
  runSummary,
}: {
  runSummary: ProjectEvaluatorStatusFields;
}) {
  const status = getProjectEvaluatorStatus({ runSummary });
  const counts = formatRetainedOutcomeCounts(runSummary);
  return (
    <TooltipTrigger delay={0}>
      <Focusable>
        <Token role="button" color={status.color}>
          {status.label}
        </Token>
      </Focusable>
      <Tooltip>
        <TooltipArrow />
        <Flex direction="column" gap="size-50">
          {status.explanation ? (
            <Text size="XS">{status.explanation}</Text>
          ) : null}
          <Text size="XS" color="text-700">
            {`Last run: ${formatRelativeOrNever(runSummary.lastRunAt)}`}
            {counts ? ` · ${counts}` : ""}
          </Text>
        </Flex>
      </Tooltip>
    </TooltipTrigger>
  );
}
