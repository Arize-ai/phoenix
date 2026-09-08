import { css } from "@emotion/react";
import { Focusable } from "react-aria";
import { useFragment } from "react-relay";
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
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import type {
  ProjectEvaluatorStats_projectEvaluator$data,
  ProjectEvaluatorStats_projectEvaluator$key,
} from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorStats_projectEvaluator.graphql";
import {
  EvaluatorCostMetricPanel,
  EvaluatorResultAnnotationMetricPanel,
  EvaluatorRunsMetricPanel,
} from "@phoenix/pages/project/evaluators/projectEvaluatorMetricPanels";
import {
  StatField,
  StatFieldList,
} from "@phoenix/pages/project/evaluators/projectEvaluatorStatFields";
import {
  formatLastRun,
  getAnnotationLevel,
  getProjectEvaluatorStatus,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { useProjectEvaluatorResultAnnotations } from "@phoenix/pages/project/evaluators/useProjectEvaluatorResultAnnotations";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

/** Matches the height of the metric chart strips above the tables. */
const stripCSS = css`
  height: ${CHART_PANEL_STRIP_DEFAULT_HEIGHT_PIXELS}px;
`;

/**
 * The stats strip at the top of the evaluator overview: the evaluator's metric
 * panels over the page's selected time range, its lifetime activity, and the
 * last run error as a banner above.
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
        createdAt
        evaluationTarget
        schedulabilityStatus
        schedulabilityReason
        project {
          id
        }
        traceProject {
          id
        }
        runSummary {
          status
          lastRunAt
          queuedCount
          evaluatedCount
          failedCount
          lastError
        }
        evaluator {
          kind
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
    <EvaluatorRunsMetricPanel
      key="evaluations"
      traceProjectId={projectEvaluator.traceProject.id}
      {...panelProps}
    />,
    // Code evaluators make no LLM calls; a cost panel would always read $0.
    ...(projectEvaluator.evaluator.kind === "LLM"
      ? [
          <EvaluatorCostMetricPanel
            key="cost"
            traceProjectId={projectEvaluator.traceProject.id}
            title="Cost"
            {...panelProps}
          />,
        ]
      : []),
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

/** The evaluator's status and lifetime run totals, tiled like the metric panels. */
function ProjectEvaluatorActivityPanel({
  projectEvaluator,
}: {
  projectEvaluator: ProjectEvaluatorStats_projectEvaluator$data;
}) {
  const { runSummary } = projectEvaluator;
  const status = getProjectEvaluatorStatus({
    schedulabilityStatus: projectEvaluator.schedulabilityStatus,
    schedulabilityReason: projectEvaluator.schedulabilityReason,
    runSummary,
  });
  const { shortDateFormatter, fullTimeFormatter } = useTimeFormatters();
  return (
    <ChartPanel
      title="Activity"
      subtitle="Run recency and lifetime totals"
      fillHeight
    >
      <StatFieldList>
        <StatField label="status">
          <TooltipTrigger delay={0}>
            <Focusable>
              <Badge variant={status.variant}>{status.label}</Badge>
            </Focusable>
            <Tooltip>
              <TooltipArrow />
              <Text size="XS">{status.explanation}</Text>
            </Tooltip>
          </TooltipTrigger>
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
          <Text size="S">{intFormatter(runSummary.queuedCount)}</Text>
        </StatField>
        <StatField label="evaluated">
          <Text size="S">{intFormatter(runSummary.evaluatedCount)}</Text>
        </StatField>
        <StatField label="failed">
          <Text
            size="S"
            color={runSummary.failedCount > 0 ? "danger" : undefined}
          >
            {intFormatter(runSummary.failedCount)}
          </Text>
        </StatField>
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
