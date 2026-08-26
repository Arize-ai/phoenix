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
import { Token } from "@phoenix/components/core/token";
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
  formatLastRun,
  getAnnotationLevel,
  getProjectEvaluatorStatus,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { useProjectEvaluatorResultAnnotations } from "@phoenix/pages/project/evaluators/useProjectEvaluatorResultAnnotations";
import { languageLabel } from "@phoenix/pages/settings/sandboxes/utils";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

/**
 * The strip fills the height the metric chart strips above the tables open
 * at, so the panels read at the same size here; past the width where its
 * panels no longer fit side by side it scrolls horizontally instead of
 * wrapping.
 */
const stripCSS = css`
  height: ${CHART_PANEL_STRIP_DEFAULT_HEIGHT_PIXELS}px;
`;

/**
 * The stats strip at the top of the evaluator overview: the same metric panels
 * the Metrics tab renders — how the evaluator's results are trending, its run
 * volume by status, and what its runs cost — over the page's selected time
 * range, plus its lifetime activity, with the last run error surfaced as a
 * banner above the panels.
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
          ... on CodeEvaluator {
            language
          }
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
  // Built as an array so the strip's chartCount — the width at which it must
  // scroll rather than squeeze the panels — cannot drift from the content.
  const panels = [
    // The annotations the evaluator produces lead the strip — they are the
    // metric the evaluator exists to compute; run volume and cost are its
    // operational readings.
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
    // Code evaluators make no LLM calls, so a cost panel would only ever
    // read $0.
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

  // The parent layout spaces the banner and the strip; the overview container
  // supplies the gutters, so the strip adds none of its own.
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

const activityFieldsCSS = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--global-dimension-size-200);
  align-content: start;
  margin: 0;
  height: 100%;

  dt,
  dd {
    margin: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  /* Numeric values line up with the tabular figures of the chart panels */
  dd {
    font-variant-numeric: tabular-nums;
  }

  .project-evaluator-stats__activity-field {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-25);
    min-width: 0;
  }
`;

function ActivityField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="project-evaluator-stats__activity-field">
      <dt>
        <Text size="XS" color="text-700">
          {label}
        </Text>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * The evaluator's lifetime run bookkeeping — the former Stats card, rendered
 * in a ChartPanel so it sits flush with the metric panels beside it.
 */
function ProjectEvaluatorActivityPanel({
  projectEvaluator,
}: {
  projectEvaluator: ProjectEvaluatorStats_projectEvaluator$data;
}) {
  const { runSummary, evaluator } = projectEvaluator;
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
      <dl css={activityFieldsCSS}>
        <ActivityField label="status">
          {/* The label alone says what; the explanation on hover says why,
              matching the status cell in the evaluators table. */}
          <TooltipTrigger delay={0}>
            <Focusable>
              <Token role="button" color={status.color}>
                {status.label}
              </Token>
            </Focusable>
            <Tooltip>
              <TooltipArrow />
              <Text size="XS">{status.explanation}</Text>
            </Tooltip>
          </TooltipTrigger>
        </ActivityField>
        <ActivityField label="last run">
          {runSummary.lastRunAt == null ? (
            <Text size="S">{formatLastRun(runSummary.lastRunAt)}</Text>
          ) : (
            // The absolute time behind the relative phrasing. "2 hours ago"
            // answers "is it running?"; the tooltip answers "which run?".
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
        </ActivityField>
        <ActivityField label="queued">
          <Text size="S">{intFormatter(runSummary.queuedCount)}</Text>
        </ActivityField>
        <ActivityField label="evaluated">
          <Text size="S">{intFormatter(runSummary.evaluatedCount)}</Text>
        </ActivityField>
        <ActivityField label="failed">
          <Text
            size="S"
            color={runSummary.failedCount > 0 ? "danger" : undefined}
          >
            {intFormatter(runSummary.failedCount)}
          </Text>
        </ActivityField>
        <ActivityField label="created">
          <Text size="S">
            <time dateTime={projectEvaluator.createdAt}>
              {shortDateFormatter(new Date(projectEvaluator.createdAt))}
            </time>
          </Text>
        </ActivityField>
        {evaluator.language ? (
          <ActivityField label="language">
            <Text size="S">{languageLabel(evaluator.language)}</Text>
          </ActivityField>
        ) : null}
      </dl>
    </ChartPanel>
  );
}
