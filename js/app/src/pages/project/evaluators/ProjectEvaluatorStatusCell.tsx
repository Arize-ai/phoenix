import { Focusable } from "react-aria";

import { Flex, Text } from "@phoenix/components";
import { Token } from "@phoenix/components/core/token";
import {
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components/core/tooltip";
import type { ProjectEvaluatorRunSummary } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  formatLastRun,
  formatProjectEvaluatorRunCounts,
  getProjectEvaluatorStatus,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

export function ProjectEvaluatorStatusCell({
  schedulabilityStatus,
  schedulabilityReason,
  runSummary,
}: {
  schedulabilityStatus: string;
  schedulabilityReason: string | null | undefined;
  runSummary: ProjectEvaluatorRunSummary;
}) {
  const status = getProjectEvaluatorStatus({
    schedulabilityStatus,
    schedulabilityReason,
    runSummary,
  });
  const counts = formatProjectEvaluatorRunCounts(runSummary);
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
          <Text size="XS">{status.explanation}</Text>
          <Text size="XS" color="text-700">
            {`Last run: ${formatLastRun(runSummary.lastRunAt)}`}
            {counts ? ` · ${counts}` : ""}
          </Text>
        </Flex>
      </Tooltip>
    </TooltipTrigger>
  );
}
