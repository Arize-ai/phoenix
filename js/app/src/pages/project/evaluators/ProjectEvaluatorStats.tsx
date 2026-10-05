import { css } from "@emotion/react";
import { addMinutes, startOfMinute, subDays } from "date-fns";
import { Suspense, useState } from "react";
import { Focusable } from "react-aria";
import { useFragment, useLazyLoadQuery } from "react-relay";
import { graphql } from "relay-runtime";

import {
  Alert,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import {
  CHART_PANEL_STRIP_DEFAULT_HEIGHT_PIXELS,
  ChartPanel,
  ChartPanelStrip,
} from "@phoenix/components/chart";
import { Badge } from "@phoenix/components/core/badge";
import { useProjectEvaluatorResultAnnotations } from "@phoenix/hooks/useProjectEvaluatorResultAnnotations";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import type {
  ProjectEvaluatorStats_projectEvaluator$data,
  ProjectEvaluatorStats_projectEvaluator$key,
} from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorStats_projectEvaluator.graphql";
import type { ProjectEvaluatorStatsDailyRatesQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorStatsDailyRatesQuery.graphql";
import { ProjectEvaluatorLoad } from "@phoenix/pages/project/evaluators/ProjectEvaluatorLoadCell";
import { EvaluatorResultAnnotationMetricPanel } from "@phoenix/pages/project/evaluators/projectEvaluatorMetricPanels";
import {
  StatField,
  StatFieldList,
} from "@phoenix/pages/project/evaluators/projectEvaluatorStatFields";
import {
  formatElapsedShort,
  formatLastRun,
  getAnnotationLevel,
  getProjectEvaluatorStatus,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

/** Matches the height of the metric chart strips above the tables. */
const stripCSS = css`
  height: ${CHART_PANEL_STRIP_DEFAULT_HEIGHT_PIXELS}px;
`;

/**
 * The stats strip at the top of the evaluator overview: the evaluator's results
 * over the page's selected time range, its activity, and the last run error as
 * a banner above. Run volume, latency and cost are on the Metrics tab.
 */
export function ProjectEvaluatorStats({
  projectEvaluatorRef,
  timeRange,
  onTimeRangeSelected,
}: {
  projectEvaluatorRef: ProjectEvaluatorStats_projectEvaluator$key;
  /** The page's selected time range, shared with the Metrics tab. */
  timeRange: TimeRange;
  /** Called when a brush selection on a panel narrows the range. */
  onTimeRangeSelected: (timeRange: TimeRange) => void;
}) {
  const projectEvaluator = useFragment(
    graphql`
      fragment ProjectEvaluatorStats_projectEvaluator on ProjectEvaluator {
        id
        createdAt
        evaluationTarget
        project {
          id
        }
        runSummary {
          status
          lastRunAt
          queuedCount
          oldestQueuedAt
          lastError
        }
        evaluationLoad {
          evaluationCount
          meanEvaluationSeconds
          shareOfEvaluationTime
        }
        ...useProjectEvaluatorResultAnnotationsFragment
      }
    `,
    projectEvaluatorRef
  );
  const resultAnnotations =
    useProjectEvaluatorResultAnnotations(projectEvaluator);
  const annotationLevel = getAnnotationLevel(projectEvaluator.evaluationTarget);
  const { runSummary } = projectEvaluator;
  const panelProps = { timeRange, onTimeRangeSelected, fillHeight: true };
  // An array so the strip's chartCount cannot drift from the rendered panels.
  const panels = [
    // The evaluator's own results lead the strip.
    ...resultAnnotations.map((annotation) => (
      <EvaluatorResultAnnotationMetricPanel
        key={annotation.name}
        evaluatedProjectId={projectEvaluator.project.id}
        annotationLevel={annotationLevel}
        annotation={annotation}
        // A lone result annotation needs no name to tell it apart.
        title={resultAnnotations.length > 1 ? annotation.name : "Annotations"}
        {...panelProps}
      />
    )),
    <ProjectEvaluatorActivityPanel
      key="activity"
      projectEvaluator={projectEvaluator}
    />,
  ];

  return (
    <>
      {runSummary.lastError ? (
        <Alert variant="danger" title="Last error">
          <Text size="S" fontFamily="mono">
            {runSummary.lastError}
          </Text>
        </Alert>
      ) : null}
      <div css={stripCSS}>
        <ChartPanelStrip chartCount={panels.length}>{panels}</ChartPanelStrip>
      </div>
    </>
  );
}

/** The evaluator's status, queue, load and daily rates, tiled like the metric panels. */
function ProjectEvaluatorActivityPanel({
  projectEvaluator,
}: {
  projectEvaluator: ProjectEvaluatorStats_projectEvaluator$data;
}) {
  const { runSummary } = projectEvaluator;
  const status = getProjectEvaluatorStatus({ runSummary });
  const { shortDateFormatter, fullTimeFormatter } = useTimeFormatters();
  // Held here, outside the suspending rates, so their retries reuse one range and query.
  const [dailyRateTimeRange] = useState(() => {
    // Through the end of the current minute, so the latest runs count.
    const end = addMinutes(startOfMinute(new Date()), 1);
    return {
      start: subDays(end, DAILY_RATE_DAYS).toISOString(),
      end: end.toISOString(),
    };
  });
  return (
    <ChartPanel title="Activity" subtitle="Status, queue, and load" fillHeight>
      <StatFieldList>
        <StatField label="status">
          {status.explanation ? (
            <TooltipTrigger delay={0}>
              <Focusable>
                <Badge variant={status.variant}>{status.label}</Badge>
              </Focusable>
              <Tooltip>
                <TooltipArrow />
                <Text size="XS">{status.explanation}</Text>
              </Tooltip>
            </TooltipTrigger>
          ) : (
            <Badge variant={status.variant}>{status.label}</Badge>
          )}
        </StatField>
        <StatField label="last run">
          {runSummary.lastRunAt == null ? (
            <Text size="S">{formatLastRun(runSummary.lastRunAt)}</Text>
          ) : (
            // Relative time, with the absolute timestamp on hover.
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
        </StatField>
        <StatField label="queued">
          <Text size="S">
            {intFormatter(runSummary.queuedCount)}
            {runSummary.oldestQueuedAt != null
              ? ` · ${formatElapsedShort(runSummary.oldestQueuedAt)} waiting`
              : ""}
          </Text>
        </StatField>
        <StatField label="load">
          <ProjectEvaluatorLoad
            evaluationLoad={projectEvaluator.evaluationLoad}
            size="S"
          />
        </StatField>
        <Suspense
          fallback={
            <ProjectEvaluatorDailyRateField evaluated={null} failed={null} />
          }
        >
          <ProjectEvaluatorDailyRates
            projectEvaluatorId={projectEvaluator.id}
            timeRange={dailyRateTimeRange}
          />
        </Suspense>
        <StatField label="created">
          <Text size="S">
            <time dateTime={projectEvaluator.createdAt}>
              {shortDateFormatter(new Date(projectEvaluator.createdAt))}
            </time>
          </Text>
        </StatField>
      </StatFieldList>
    </ChartPanel>
  );
}

const DAILY_RATE_DAYS = 7;

const dailyRateFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

/** Evaluations completed and given up on per day, averaged over the last week. */
function ProjectEvaluatorDailyRates({
  projectEvaluatorId,
  timeRange,
}: {
  projectEvaluatorId: string;
  timeRange: { start: string; end: string };
}) {
  const data = useLazyLoadQuery<ProjectEvaluatorStatsDailyRatesQuery>(
    graphql`
      query ProjectEvaluatorStatsDailyRatesQuery(
        $projectEvaluatorId: ID!
        $timeRange: TimeRange!
      ) {
        projectEvaluator: node(id: $projectEvaluatorId) {
          ... on ProjectEvaluator {
            failureSummary(timeRange: $timeRange) {
              evaluatedCount
              failedCount
            }
          }
        }
      }
    `,
    { projectEvaluatorId, timeRange }
  );
  const summary = data.projectEvaluator?.failureSummary;
  return (
    <ProjectEvaluatorDailyRateField
      evaluated={(summary?.evaluatedCount ?? 0) / DAILY_RATE_DAYS}
      failed={(summary?.failedCount ?? 0) / DAILY_RATE_DAYS}
    />
  );
}

function ProjectEvaluatorDailyRateField({
  evaluated,
  failed,
}: {
  evaluated: number | null;
  failed: number | null;
}) {
  return (
    <StatField label={`per day (${DAILY_RATE_DAYS}d)`}>
      {evaluated == null || failed == null ? (
        <Text size="S">--</Text>
      ) : (
        <Text size="S">
          {`${dailyRateFormatter.format(evaluated)} evaluated · `}
          <Text size="S" color={failed > 0 ? "danger" : undefined}>
            {`${dailyRateFormatter.format(failed)} failed`}
          </Text>
        </Text>
      )}
    </StatField>
  );
}
