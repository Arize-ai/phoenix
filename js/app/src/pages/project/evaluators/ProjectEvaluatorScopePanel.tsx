import { css } from "@emotion/react";
import type { ComponentType } from "react";
import { Suspense, useState, useTransition } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import type { ProjectEvaluatorScopePanelCountQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopePanelCountQuery.graphql";
import type { ProjectEvaluatorScopePanelSessionCountQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopePanelSessionCountQuery.graphql";
import type { ProjectEvaluatorScopePanelSessionsQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopePanelSessionsQuery.graphql";
import type { ProjectEvaluatorScopePanelSpansQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopePanelSpansQuery.graphql";
import type { ProjectEvaluatorScopePanelTraceCountQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopePanelTraceCountQuery.graphql";
import type { ProjectEvaluatorScopePanelTracesQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopePanelTracesQuery.graphql";
import {
  makeTimeWindow,
  type ProjectEvaluatorInlineCode,
  ProjectEvaluatorTestBench,
  ProjectEvaluatorTestBenchFallback,
  type TestBenchHeaderProps,
  type TimeWindow,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorTestBench";
import {
  getContextSnippet,
  type RecordedRunRow,
  SAMPLE_ROW_KEY,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";
import {
  type ProjectEvaluatorRecordKind,
  type ProjectEvaluatorScope,
  toEvaluatorRecordKind,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { getSampleSessionEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSessionEvaluationContext";
import { getSampleSpanEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";
import { getSampleTraceEvaluationContext } from "@phoenix/pages/project/evaluators/sampleTraceEvaluationContext";
import {
  getSessionDetailsPath,
  getTraceDetailsPath,
} from "@phoenix/utils/urlUtils";

export type { ProjectEvaluatorInlineCode } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTestBench";

type MatchedCountLineProps = {
  projectId: string;
  filterCondition: string;
  timeWindow: TimeWindow;
};

type RecordSourceProps = TestBenchHeaderProps & {
  projectId: string;
  filterCondition: string;
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
  playgroundStore?: ReturnType<typeof usePlaygroundStore>;
  requiredVariables?: string[];
};

/**
 * What the bench varies by record kind: how it counts the records in scope
 * and how it lists them. The prose around them names the record kind directly.
 */
const RECORD_SOURCE_BY_RECORD_KIND: Record<
  ProjectEvaluatorRecordKind,
  {
    CountLine: ComponentType<MatchedCountLineProps>;
    RecordSource: ComponentType<RecordSourceProps>;
  }
> = {
  span: { CountLine: MatchedSpanCountLine, RecordSource: SpanRecordSource },
  trace: { CountLine: MatchedTraceCountLine, RecordSource: TraceRecordSource },
  session: {
    CountLine: MatchedSessionCountLine,
    RecordSource: SessionRecordSource,
  },
};

/** Scope is committed by the form's create/save action, not by this panel. */
export const ProjectEvaluatorScopePanel = ({
  projectId,
  scope,
  codeEvaluatorId,
  inlineCode,
  requiredVariables,
}: {
  projectId: string;
  scope: ProjectEvaluatorScope;
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
  requiredVariables?: string[];
}) => {
  const [timeWindow, setTimeWindow] = useState(() => makeTimeWindow("7d"));
  const [, startWindowTransition] = useTransition();
  // A target or filter change swaps the records wholesale, so the bench shows
  // its loading state under the new title: the switch of level is the point.
  // A window change keeps the same records in view while the next page loads,
  // so it is a transition.
  const { filterCondition } = scope;
  const recordKind = toEvaluatorRecordKind(scope.targetType);
  const { CountLine, RecordSource } = RECORD_SOURCE_BY_RECORD_KIND[recordKind];
  const headerProps: TestBenchHeaderProps = {
    targetType: scope.targetType,
    timeWindow,
    onTimeWindowChange: (next) =>
      startWindowTransition(() => setTimeWindow(next)),
    countLine: (
      <CountLine
        projectId={projectId}
        filterCondition={filterCondition}
        timeWindow={timeWindow}
      />
    ),
  };
  const sourceProps: RecordSourceProps = {
    ...headerProps,
    projectId,
    filterCondition,
    codeEvaluatorId,
    inlineCode,
    requiredVariables,
  };
  return (
    <div css={panelCSS}>
      <Suspense
        fallback={<ProjectEvaluatorTestBenchFallback {...headerProps} />}
      >
        {codeEvaluatorId || inlineCode ? (
          <RecordSource {...sourceProps} />
        ) : (
          <LlmRecordSource RecordSource={RecordSource} {...sourceProps} />
        )}
      </Suspense>
    </div>
  );
};

/** An LLM evaluator's runs also read the playground store, which only a hook reaches. */
function LlmRecordSource({
  RecordSource,
  ...props
}: Omit<RecordSourceProps, "playgroundStore"> & {
  RecordSource: ComponentType<RecordSourceProps>;
}) {
  const playgroundStore = usePlaygroundStore();
  return <RecordSource {...props} playgroundStore={playgroundStore} />;
}

const panelCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
`;

function useMatchedSpanCount({
  projectId,
  filterCondition,
  startIso,
}: {
  projectId: string;
  filterCondition: string;
  startIso: string;
}) {
  const data = useLazyLoadQuery<ProjectEvaluatorScopePanelCountQuery>(
    graphql`
      query ProjectEvaluatorScopePanelCountQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $filterCondition: String
      ) {
        project: node(id: $projectId) {
          ... on Project {
            spanCountTimeSeries(
              timeRange: $timeRange
              filterCondition: $filterCondition
            ) {
              data {
                totalCount
              }
            }
          }
        }
      }
    `,
    {
      projectId,
      timeRange: { start: startIso },
      filterCondition: filterCondition.trim() || null,
    },
    { fetchPolicy: "store-and-network" }
  );
  return (
    data.project?.spanCountTimeSeries?.data.reduce(
      (total, point) => total + (point.totalCount ?? 0),
      0
    ) ?? 0
  );
}

function MatchedSpanCountLine({
  projectId,
  filterCondition,
  timeWindow,
}: MatchedCountLineProps) {
  const matchedCount = useMatchedSpanCount({
    projectId,
    filterCondition,
    startIso: timeWindow.startIso,
  });
  return <>{formatMatchedCount(matchedCount, "span")}</>;
}

function MatchedSessionCountLine({
  projectId,
  filterCondition,
  timeWindow,
}: MatchedCountLineProps) {
  const data = useLazyLoadQuery<ProjectEvaluatorScopePanelSessionCountQuery>(
    graphql`
      query ProjectEvaluatorScopePanelSessionCountQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $sessionFilterCondition: String
      ) {
        project: node(id: $projectId) {
          ... on Project {
            sessionCount(
              timeRange: $timeRange
              sessionFilterCondition: $sessionFilterCondition
            )
          }
        }
      }
    `,
    {
      projectId,
      timeRange: { start: timeWindow.startIso },
      sessionFilterCondition: filterCondition.trim() || null,
    },
    { fetchPolicy: "store-and-network" }
  );
  return <>{formatMatchedCount(data.project?.sessionCount ?? 0, "session")}</>;
}

/**
 * "12 spans matched in the", "No sessions matched in the": the phrase the
 * bench finishes with its time window picker, so the sentence reads as one.
 */
function formatMatchedCount(
  matchedCount: number,
  recordKind: ProjectEvaluatorRecordKind
): string {
  if (matchedCount === 0) {
    return `No ${recordKind}s matched in the`;
  }
  return `${matchedCount.toLocaleString()} ${recordKind}${
    matchedCount === 1 ? "" : "s"
  } matched in the`;
}

/** The API has no filtered trace count; the count is probed from listed traces and floors here. */
const TRACE_COUNT_PROBE_LIMIT = 100;

/** Traces are listed as their root spans, the only trace-filtered listing the API offers. */
function MatchedTraceCountLine({
  projectId,
  filterCondition,
  timeWindow,
}: MatchedCountLineProps) {
  const data = useLazyLoadQuery<ProjectEvaluatorScopePanelTraceCountQuery>(
    graphql`
      query ProjectEvaluatorScopePanelTraceCountQuery(
        $projectId: ID!
        $timeRange: TimeRange
        $traceFilterCondition: String
        $first: Int!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            rootSpans: spans(
              first: $first
              filterCondition: "parent_span is None"
              sort: { col: startTime, dir: desc }
              traceFilterCondition: $traceFilterCondition
              timeRange: $timeRange
            ) {
              edges {
                span: node {
                  id
                }
              }
              pageInfo {
                hasNextPage
              }
            }
          }
        }
      }
    `,
    {
      projectId,
      traceFilterCondition: filterCondition.trim() || null,
      timeRange: { start: timeWindow.startIso },
      first: TRACE_COUNT_PROBE_LIMIT,
    },
    { fetchPolicy: "store-and-network" }
  );
  const matchedCount = data.project?.rootSpans?.edges.length ?? 0;
  const hasMore = data.project?.rootSpans?.pageInfo.hasNextPage ?? false;
  return (
    <>
      {hasMore
        ? `Over ${TRACE_COUNT_PROBE_LIMIT.toLocaleString()} traces matched in the`
        : formatMatchedCount(matchedCount, "trace")}
    </>
  );
}

/** Rows arrive in pages of this many; the first page fits the table without scrolling. */
const RECORD_PAGE_SIZE = 10;

/** No search params to carry over: the bench's own URL has nothing the viewer should inherit. */
const NO_SEARCH_PARAMS = new URLSearchParams();

function formatTraceMetric(numSpans: number, totalTokens: number): string {
  const spans = `${numSpans.toLocaleString()} span${numSpans === 1 ? "" : "s"}`;
  return `${spans} · ${totalTokens.toLocaleString()} tokens`;
}

function TraceRecordSource({
  projectId,
  filterCondition,
  ...benchProps
}: RecordSourceProps) {
  const [limit, setLimit] = useState(RECORD_PAGE_SIZE);
  const [isShowingMore, startShowMoreTransition] = useTransition();
  const data = useLazyLoadQuery<ProjectEvaluatorScopePanelTracesQuery>(
    graphql`
      query ProjectEvaluatorScopePanelTracesQuery(
        $projectId: ID!
        $traceFilterCondition: String
        $timeRange: TimeRange
        $first: Int!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            rootSpans: spans(
              first: $first
              filterCondition: "parent_span is None"
              sort: { col: startTime, dir: desc }
              traceFilterCondition: $traceFilterCondition
              timeRange: $timeRange
            ) {
              edges {
                span: node {
                  id
                  name
                  trace {
                    id
                    traceId
                    numSpans
                    startTime
                    latencyMs
                    evaluationContext
                    costSummary {
                      total {
                        tokens
                      }
                    }
                  }
                }
              }
              pageInfo {
                hasNextPage
              }
            }
          }
        }
      }
    `,
    {
      projectId,
      traceFilterCondition: filterCondition.trim() || null,
      timeRange: { start: benchProps.timeWindow.startIso },
      first: limit,
    },
    { fetchPolicy: "store-and-network" }
  );
  const rootSpans = data.project?.rootSpans?.edges.map(({ span }) => span);
  const sample = rootSpans?.length ? null : getSampleTraceEvaluationContext();
  const rows: RecordedRunRow[] = rootSpans?.length
    ? rootSpans.map(({ name, trace }) => ({
        key: trace.id,
        name,
        recordId: trace.traceId,
        snippet: getContextSnippet(trace.evaluationContext),
        startTime: trace.startTime,
        latencyMs: trace.latencyMs,
        context: trace.evaluationContext,
        isSample: false,
        unavailableReason:
          trace.evaluationContext == null
            ? "This trace has no root span to evaluate."
            : undefined,
        metric: formatTraceMetric(
          trace.numSpans,
          trace.costSummary.total.tokens ?? 0
        ),
        href: getTraceDetailsPath({
          basePath: `/projects/${projectId}/traces`,
          traceId: trace.traceId,
          searchParams: NO_SEARCH_PARAMS,
        }),
      }))
    : sample
      ? [
          {
            key: SAMPLE_ROW_KEY,
            name: "Sample trace",
            recordId: "sample",
            snippet: getContextSnippet(sample.context),
            context: sample.context,
            isSample: true,
          },
        ]
      : [];
  return (
    <ProjectEvaluatorTestBench
      {...benchProps}
      rows={rows}
      recordKind="trace"
      hasMore={data.project?.rootSpans?.pageInfo.hasNextPage ?? false}
      isLoadingMore={isShowingMore}
      onLoadMore={() =>
        startShowMoreTransition(() => {
          setLimit((current) => current + RECORD_PAGE_SIZE);
        })
      }
    />
  );
}

function formatSessionMetric(numTraces: number, totalTokens: number): string {
  const traces = `${numTraces.toLocaleString()} trace${
    numTraces === 1 ? "" : "s"
  }`;
  return `${traces} · ${totalTokens.toLocaleString()} tokens`;
}

/**
 * The sessions this evaluator would run on, each carrying the same evaluation
 * context a live session evaluation binds against, so a row can be tested.
 */
function SessionRecordSource({
  projectId,
  filterCondition,
  ...benchProps
}: RecordSourceProps) {
  const [limit, setLimit] = useState(RECORD_PAGE_SIZE);
  const [isShowingMore, startShowMoreTransition] = useTransition();
  const data = useLazyLoadQuery<ProjectEvaluatorScopePanelSessionsQuery>(
    graphql`
      query ProjectEvaluatorScopePanelSessionsQuery(
        $projectId: ID!
        $sessionFilterCondition: String
        $timeRange: TimeRange
        $first: Int!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            sessions(
              first: $first
              sort: { col: startTime, dir: desc }
              sessionFilterCondition: $sessionFilterCondition
              timeRange: $timeRange
            ) {
              edges {
                session: node {
                  id
                  sessionId
                  numTraces
                  startTime
                  tokenUsage {
                    total
                  }
                  sessionEvaluationContext
                }
              }
              pageInfo {
                hasNextPage
              }
            }
          }
        }
      }
    `,
    {
      projectId,
      sessionFilterCondition: filterCondition.trim() || null,
      timeRange: { start: benchProps.timeWindow.startIso },
      first: limit,
    },
    { fetchPolicy: "store-and-network" }
  );
  const sessions = data.project?.sessions?.edges.map(({ session }) => session);
  const sample = sessions?.length ? null : getSampleSessionEvaluationContext();
  const rows: RecordedRunRow[] = sessions?.length
    ? sessions.map((session) => ({
        key: session.id,
        name: session.sessionId,
        recordId: session.sessionId,
        snippet: getContextSnippet(session.sessionEvaluationContext),
        startTime: session.startTime,
        context: session.sessionEvaluationContext,
        isSample: false,
        unavailableReason:
          session.sessionEvaluationContext == null
            ? "This session has no turns to evaluate."
            : undefined,
        metric: formatSessionMetric(
          session.numTraces,
          session.tokenUsage.total
        ),
        href: getSessionDetailsPath({
          basePath: `/projects/${projectId}/sessions`,
          sessionId: session.id,
          searchParams: NO_SEARCH_PARAMS,
        }),
      }))
    : sample
      ? [
          {
            key: SAMPLE_ROW_KEY,
            name: "Sample session",
            recordId: "sample",
            snippet: getContextSnippet(sample.context),
            context: sample.context,
            isSample: true,
          },
        ]
      : [];
  return (
    <ProjectEvaluatorTestBench
      {...benchProps}
      rows={rows}
      recordKind="session"
      hasMore={data.project?.sessions?.pageInfo.hasNextPage ?? false}
      isLoadingMore={isShowingMore}
      onLoadMore={() =>
        startShowMoreTransition(() => {
          setLimit((current) => current + RECORD_PAGE_SIZE);
        })
      }
    />
  );
}

function SpanRecordSource({
  projectId,
  filterCondition,
  ...benchProps
}: RecordSourceProps) {
  const [limit, setLimit] = useState(RECORD_PAGE_SIZE);
  const [isShowingMore, startShowMoreTransition] = useTransition();
  const data = useLazyLoadQuery<ProjectEvaluatorScopePanelSpansQuery>(
    graphql`
      query ProjectEvaluatorScopePanelSpansQuery(
        $projectId: ID!
        $filterCondition: String
        $timeRange: TimeRange
        $first: Int!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            spans(
              first: $first
              sort: { col: startTime, dir: desc }
              filterCondition: $filterCondition
              timeRange: $timeRange
            ) {
              edges {
                span: node {
                  id
                  name
                  spanId
                  spanKind
                  startTime
                  latencyMs
                  evaluationContext
                  trace {
                    traceId
                  }
                }
              }
              pageInfo {
                hasNextPage
              }
            }
          }
        }
      }
    `,
    {
      projectId,
      filterCondition: filterCondition.trim() || null,
      timeRange: { start: benchProps.timeWindow.startIso },
      first: limit,
    },
    { fetchPolicy: "store-and-network" }
  );
  const spans = data.project?.spans?.edges.map(({ span }) => span) ?? [];
  const sample = spans.length === 0 ? getSampleSpanEvaluationContext() : null;
  const rows: RecordedRunRow[] = spans.length
    ? spans.map((span) => ({
        key: span.id,
        name: span.name,
        recordId: span.spanId,
        snippet: getContextSnippet(span.evaluationContext),
        spanKind: span.spanKind,
        startTime: span.startTime,
        latencyMs: span.latencyMs,
        context: span.evaluationContext,
        isSample: false,
        href: getTraceDetailsPath({
          basePath: `/projects/${projectId}/traces`,
          traceId: span.trace.traceId,
          spanNodeId: span.id,
          searchParams: NO_SEARCH_PARAMS,
        }),
      }))
    : sample
      ? [
          {
            key: SAMPLE_ROW_KEY,
            name: `Sample ${sample.spanKind} span`,
            recordId: "sample",
            snippet: getContextSnippet(sample.context),
            spanKind: sample.spanKind.toLowerCase(),
            context: sample.context,
            isSample: true,
          },
        ]
      : [];
  return (
    <ProjectEvaluatorTestBench
      {...benchProps}
      rows={rows}
      recordKind="span"
      hasMore={data.project?.spans?.pageInfo.hasNextPage ?? false}
      isLoadingMore={isShowingMore}
      onLoadMore={() =>
        startShowMoreTransition(() => {
          setLimit((current) => current + RECORD_PAGE_SIZE);
        })
      }
    />
  );
}
