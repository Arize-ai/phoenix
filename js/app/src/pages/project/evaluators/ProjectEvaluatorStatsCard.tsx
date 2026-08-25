import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import {
  Alert,
  Card,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@phoenix/components";
import {
  EvaluatorDetailList,
  EvaluatorDetailRow,
} from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import type { ProjectEvaluatorStatsCard_projectEvaluator$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorStatsCard_projectEvaluator.graphql";
import { formatLastRun } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { languageLabel } from "@phoenix/pages/settings/sandboxes/utils";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

/** Compact supplementary metadata for the evaluator overview. */
export function ProjectEvaluatorStatsCard({
  projectEvaluatorRef,
}: {
  projectEvaluatorRef: ProjectEvaluatorStatsCard_projectEvaluator$key;
}) {
  const projectEvaluator = useFragment(
    graphql`
      fragment ProjectEvaluatorStatsCard_projectEvaluator on ProjectEvaluator {
        createdAt
        runSummary {
          lastRunAt
          queuedCount
          evaluatedCount
          failedCount
          lastError
        }
        evaluator {
          ... on CodeEvaluator {
            language
          }
        }
      }
    `,
    projectEvaluatorRef
  );
  const { evaluator, runSummary } = projectEvaluator;
  const { shortDateFormatter, fullTimeFormatter } = useTimeFormatters();

  return (
    <Card title="Stats">
      <EvaluatorDetailList>
        <EvaluatorDetailRow label="Last run">
          {runSummary.lastRunAt == null ? (
            formatLastRun(runSummary.lastRunAt)
          ) : (
            // The absolute time behind the relative phrasing. "2 hours ago"
            // answers "is it running?"; the tooltip answers "which run was
            // that?".
            <TooltipTrigger delay={64}>
              <TriggerWrap>
                <Text size="S">{formatLastRun(runSummary.lastRunAt)}</Text>
              </TriggerWrap>
              <Tooltip>
                <TooltipArrow />
                {fullTimeFormatter(new Date(runSummary.lastRunAt))}
              </Tooltip>
            </TooltipTrigger>
          )}
        </EvaluatorDetailRow>
        <EvaluatorDetailRow label="Evaluated">
          {intFormatter(runSummary.evaluatedCount)}
        </EvaluatorDetailRow>
        <EvaluatorDetailRow label="Failed">
          <Text
            size="S"
            color={runSummary.failedCount > 0 ? "danger" : undefined}
          >
            {intFormatter(runSummary.failedCount)}
          </Text>
        </EvaluatorDetailRow>
        <EvaluatorDetailRow label="Queued">
          {intFormatter(runSummary.queuedCount)}
        </EvaluatorDetailRow>
        {evaluator.language ? (
          <EvaluatorDetailRow label="Language">
            {languageLabel(evaluator.language)}
          </EvaluatorDetailRow>
        ) : null}
        <EvaluatorDetailRow label="Created">
          <Text size="S">
            <time dateTime={projectEvaluator.createdAt}>
              {shortDateFormatter(new Date(projectEvaluator.createdAt))}
            </time>
          </Text>
        </EvaluatorDetailRow>
      </EvaluatorDetailList>
      {runSummary.lastError ? (
        <View
          paddingX="size-200"
          paddingBottom="size-200"
          paddingTop="size-100"
        >
          <Alert variant="danger" title="Last error">
            <Text size="S" fontFamily="mono">
              {runSummary.lastError}
            </Text>
          </Alert>
        </View>
      ) : null}
    </Card>
  );
}
