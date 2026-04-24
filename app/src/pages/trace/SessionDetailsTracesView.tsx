import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery, usePaginationFragment } from "react-relay";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { useSearchParams } from "react-router";

import {
  Empty,
  Flex,
  Icon,
  Icons,
  Loading,
  Text,
  Truncate,
} from "@phoenix/components";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { TraceTreeProvider } from "@phoenix/components/trace/TraceTree";
import { TraceTreeSkeleton } from "@phoenix/components/trace/TraceTreeSkeleton";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { useTimeFormatters } from "@phoenix/hooks";
import type {
  SessionDetailsTracesView_traces$data,
  SessionDetailsTracesView_traces$key,
} from "@phoenix/pages/trace/__generated__/SessionDetailsTracesView_traces.graphql";
import type { SessionDetailsTracesViewTreeQuery } from "@phoenix/pages/trace/__generated__/SessionDetailsTracesViewTreeQuery.graphql";

import { ConnectedTraceTree } from "./ConnectedTraceTree";
import { SessionViewTabs } from "./SessionViewTabs";
import type { SessionView } from "./SessionViewTabs";
import { SpanDetails } from "./SpanDetails";

type SessionTraceRow = NonNullable<
  SessionDetailsTracesView_traces$data["traces"]["edges"][number]["trace"]
> & {
  rootSpan: NonNullable<
    SessionDetailsTracesView_traces$data["traces"]["edges"][number]["trace"]["rootSpan"]
  >;
};

type SpanClickHandler = (span: { id: string }) => void;

export function SessionDetailsTracesView({
  tracesRef,
  sessionView,
  onSessionViewChange,
  traceCount,
}: {
  tracesRef: SessionDetailsTracesView_traces$key;
  sessionView: SessionView;
  onSessionViewChange: (view: SessionView) => void;
  traceCount: number;
}) {
  const { data } = usePaginationFragment(
    graphql`
      fragment SessionDetailsTracesView_traces on ProjectSession
      @refetchable(queryName: "SessionDetailsTracesViewRefetchQuery")
      @argumentDefinitions(
        first: { type: "Int", defaultValue: 50 }
        after: { type: "String", defaultValue: null }
      ) {
        numTraces
        traces(first: $first, after: $after)
          @connection(key: "SessionDetailsTracesView_traces") {
          edges {
            trace: node {
              id
              traceId
              rootSpan {
                id
                name
                startTime
                cumulativeTokenCountTotal
                latencyMs
                project {
                  id
                }
                trace {
                  id
                  costSummary {
                    total {
                      cost
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    tracesRef
  );

  const traces: SessionTraceRow[] = (data.traces?.edges ?? [])
    .map(({ trace }) => trace)
    .filter(
      (t): t is SessionTraceRow =>
        t != null && t.rootSpan != null && t.rootSpan.project != null
    );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSpanNodeId = searchParams.get(SELECTED_SPAN_NODE_ID_PARAM);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSpanClick: SpanClickHandler = (span) => {
    setSearchParams(
      (params) => {
        params.set(SELECTED_SPAN_NODE_ID_PARAM, span.id);
        return params;
      },
      { replace: true }
    );
  };

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "session-traces-view-layout",
    storage: localStorage,
  });

  return (
    <Group
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      css={viewGroupCSS}
      data-testid="session-traces-view"
    >
      <Panel id="session-traces-list" defaultSize="50%" minSize="20%">
        <div css={tracesListPanelCSS}>
          <SessionViewTabs
            sessionView={sessionView}
            onSessionViewChange={onSessionViewChange}
            traceCount={traceCount}
          >
            <TraceRowList
              traces={traces}
              expandedIds={expandedIds}
              selectedSpanNodeId={selectedSpanNodeId}
              onToggleExpanded={toggleExpanded}
              onSpanClick={handleSpanClick}
            />
          </SessionViewTabs>
        </div>
      </Panel>
      <Separator css={compactResizeHandleCSS} />
      <Panel id="session-traces-span-details">
        <SpanDetailsPanel selectedSpanNodeId={selectedSpanNodeId} />
      </Panel>
    </Group>
  );
}

function TraceRowList({
  traces,
  expandedIds,
  selectedSpanNodeId,
  onToggleExpanded,
  onSpanClick,
}: {
  traces: SessionTraceRow[];
  expandedIds: Set<string>;
  selectedSpanNodeId: string | null;
  onToggleExpanded: (id: string) => void;
  onSpanClick: SpanClickHandler;
}) {
  return (
    <div css={traceRowListCSS} data-testid="session-trace-row-list">
      {traces.length === 0 ? (
        <Empty message="No traces in this session" />
      ) : (
        traces.map((trace, index) => (
          <TraceRow
            key={trace.id}
            trace={trace}
            index={index}
            isExpanded={expandedIds.has(trace.id)}
            selectedSpanNodeId={selectedSpanNodeId}
            onToggleExpanded={() => onToggleExpanded(trace.id)}
            onSpanClick={onSpanClick}
          />
        ))
      )}
    </div>
  );
}

function TraceRow({
  trace,
  index,
  isExpanded,
  selectedSpanNodeId,
  onToggleExpanded,
  onSpanClick,
}: {
  trace: SessionTraceRow;
  index: number;
  isExpanded: boolean;
  selectedSpanNodeId: string | null;
  onToggleExpanded: () => void;
  onSpanClick: SpanClickHandler;
}) {
  return (
    <div css={traceRowCSS} data-testid="session-trace-row">
      <TraceRowHeader
        trace={trace}
        index={index}
        isExpanded={isExpanded}
        onToggleExpanded={onToggleExpanded}
      />
      {isExpanded ? (
        <TraceTreeContainer
          traceId={trace.traceId}
          projectId={trace.rootSpan.project.id}
          selectedSpanNodeId={selectedSpanNodeId}
          onSpanClick={onSpanClick}
        />
      ) : null}
    </div>
  );
}

function TraceRowHeader({
  trace,
  index,
  isExpanded,
  onToggleExpanded,
}: {
  trace: SessionTraceRow;
  index: number;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  return (
    <button
      type="button"
      css={traceRowHeaderCSS}
      aria-expanded={isExpanded}
      onClick={onToggleExpanded}
      data-testid="session-trace-row-header"
    >
      <TraceRowChevron isExpanded={isExpanded} />
      <Flex direction="column" gap="size-100" flex={1} minWidth={0}>
        <TraceRowTitleLine trace={trace} index={index} />
        <TraceRowMetricsLine trace={trace} />
      </Flex>
    </button>
  );
}

function TraceRowChevron({ isExpanded }: { isExpanded: boolean }) {
  return (
    <span
      css={chevronCSS}
      data-expanded={isExpanded}
      data-testid="session-trace-row-chevron"
    >
      <Icon svg={<Icons.ChevronRight />} />
    </span>
  );
}

function TraceRowTitleLine({
  trace,
  index,
}: {
  trace: SessionTraceRow;
  index: number;
}) {
  const { fullTimeFormatter } = useTimeFormatters();
  const paddedIndex = String(index + 1).padStart(2, "0");
  return (
    <Flex
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap="size-100"
    >
      <Flex
        direction="row"
        gap="size-100"
        alignItems="center"
        flex={1}
        minWidth={0}
      >
        <Text
          fontFamily="mono"
          color="text-500"
          data-testid="session-trace-row-index"
        >
          {paddedIndex}
        </Text>
        <Flex flex={1} minWidth={0}>
          <Truncate maxWidth="100%" title={trace.rootSpan.name}>
            <Text weight="heavy" data-testid="session-trace-row-name">
              {trace.rootSpan.name}
            </Text>
          </Truncate>
        </Flex>
      </Flex>
      <Text
        color="text-700"
        size="XS"
        data-testid="session-trace-row-timestamp"
      >
        {fullTimeFormatter(new Date(trace.rootSpan.startTime))}
      </Text>
    </Flex>
  );
}

function TraceRowMetricsLine({ trace }: { trace: SessionTraceRow }) {
  const cost = trace.rootSpan.trace.costSummary?.total?.cost;
  const latencyMs = trace.rootSpan.latencyMs;
  return (
    <Flex
      direction="row"
      gap="size-100"
      alignItems="center"
      wrap
      data-testid="session-trace-row-metrics"
    >
      <TokenCount size="S">
        {trace.rootSpan.cumulativeTokenCountTotal ?? 0}
      </TokenCount>
      {cost != null ? <TokenCosts size="S">{cost}</TokenCosts> : null}
      {latencyMs != null ? (
        <LatencyText latencyMs={latencyMs} size="S" />
      ) : null}
    </Flex>
  );
}

function TraceTreeContainer({
  traceId,
  projectId,
  selectedSpanNodeId,
  onSpanClick,
}: {
  traceId: string;
  projectId: string;
  selectedSpanNodeId: string | null;
  onSpanClick: SpanClickHandler;
}) {
  return (
    <div css={traceTreeContainerCSS} data-testid="session-trace-tree">
      <Suspense fallback={<TraceTreeSkeleton />}>
        <LazyTraceTree
          traceId={traceId}
          projectId={projectId}
          selectedSpanNodeId={selectedSpanNodeId}
          onSpanClick={onSpanClick}
        />
      </Suspense>
    </div>
  );
}

function SpanDetailsPanel({
  selectedSpanNodeId,
}: {
  selectedSpanNodeId: string | null;
}) {
  if (!selectedSpanNodeId) {
    return (
      <Flex
        direction="row"
        alignItems="center"
        justifyContent="center"
        height="100%"
        data-testid="session-span-details-empty"
      >
        <Empty message="Expand a trace and select a span to view its details" />
      </Flex>
    );
  }
  return (
    <div css={spanDetailsContainerCSS} data-testid="session-span-details">
      <Suspense fallback={<Loading />}>
        <SpanDetails key={selectedSpanNodeId} spanNodeId={selectedSpanNodeId} />
      </Suspense>
    </div>
  );
}

function LazyTraceTree({
  traceId,
  projectId,
  selectedSpanNodeId,
  onSpanClick,
}: {
  traceId: string;
  projectId: string;
  selectedSpanNodeId: string | null;
  onSpanClick: SpanClickHandler;
}) {
  const data = useLazyLoadQuery<SessionDetailsTracesViewTreeQuery>(
    graphql`
      query SessionDetailsTracesViewTreeQuery($traceId: ID!, $projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            trace(traceId: $traceId) {
              ...ConnectedTraceTree
            }
          }
        }
      }
    `,
    { traceId, projectId }
  );
  const trace = data.project?.trace;
  if (!trace) return null;
  return (
    <TraceTreeProvider>
      <ConnectedTraceTree
        trace={trace}
        selectedSpanNodeId={selectedSpanNodeId ?? ""}
        onSpanClick={onSpanClick}
      />
    </TraceTreeProvider>
  );
}

const viewGroupCSS = css`
  flex: 1 1 auto;
  overflow: hidden;
`;

const tracesListPanelCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const traceRowListCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
`;

const traceRowCSS = css`
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--global-border-color-default);
`;

const traceRowHeaderCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-static-size-200);
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;

  &:hover {
    background: var(--global-list-item-hover-background-color);
  }
`;

const chevronCSS = css`
  flex: none;
  transition: transform 120ms ease;
  display: inline-flex;

  &[data-expanded="true"] {
    transform: rotate(90deg);
  }
`;

const traceTreeContainerCSS = css`
  max-height: 500px;
  overflow: auto;
  border-top: 1px solid var(--global-border-color-default);
  background: var(--ac-global-color-grey-75);
`;

const spanDetailsContainerCSS = css`
  height: 100%;
  overflow: auto;
`;
