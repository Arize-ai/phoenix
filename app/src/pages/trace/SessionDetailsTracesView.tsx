import { css } from "@emotion/react";
import { throttle } from "lodash";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PreloadedQuery } from "react-relay";
import {
  graphql,
  useLazyLoadQuery,
  usePaginationFragment,
  usePreloadedQuery,
} from "react-relay";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { useSearchParams } from "react-router";

import {
  DisclosureArrow,
  Empty,
  Flex,
  Loading,
  Text,
  Truncate,
  View,
} from "@phoenix/components";
import {
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { TraceTreeProvider } from "@phoenix/components/trace/TraceTree";
import { TraceTreeSkeleton } from "@phoenix/components/trace/TraceTreeSkeleton";
import {
  SELECTED_SPAN_NODE_ID_PARAM,
  SELECTED_TRACE_ID_PARAM,
} from "@phoenix/constants/searchParams";
import { useTimeFormatters } from "@phoenix/hooks";
import type {
  SessionDetailsTracesView_traces$data,
  SessionDetailsTracesView_traces$key,
} from "@phoenix/pages/trace/__generated__/SessionDetailsTracesView_traces.graphql";
import type { SessionDetailsTracesViewQuery } from "@phoenix/pages/trace/__generated__/SessionDetailsTracesViewQuery.graphql";
import type { SessionDetailsTracesViewRefetchQuery } from "@phoenix/pages/trace/__generated__/SessionDetailsTracesViewRefetchQuery.graphql";
import type { SessionDetailsTracesViewTreeQuery } from "@phoenix/pages/trace/__generated__/SessionDetailsTracesViewTreeQuery.graphql";
import { SESSION_DETAILS_PAGE_SIZE } from "@phoenix/pages/trace/constants";

import { ConnectedTraceTree } from "./ConnectedTraceTree";
import { SpanDetails } from "./SpanDetails";

const INITIAL_SELECTED_TRACE_MAX_PAGES = 3;

export const sessionDetailsTracesViewQuery = graphql`
  query SessionDetailsTracesViewQuery($id: ID!, $first: Int!) {
    session: node(id: $id) {
      ... on ProjectSession {
        ...SessionDetailsTracesView_traces @arguments(first: $first)
      }
    }
  }
`;

type SessionTraceRow = NonNullable<
  SessionDetailsTracesView_traces$data["traces"]["edges"][number]["trace"]
> & {
  rootSpan: NonNullable<
    SessionDetailsTracesView_traces$data["traces"]["edges"][number]["trace"]["rootSpan"]
  >;
};

type SpanClickHandler = ({
  traceId,
  spanNodeId,
}: {
  traceId: string;
  spanNodeId: string;
}) => void;

type TraceSelectHandler = ({
  traceId,
  spanNodeId,
}: {
  traceId: string;
  spanNodeId: string;
}) => void;

export function SessionDetailsTracesView({
  queryRef,
}: {
  queryRef: PreloadedQuery<SessionDetailsTracesViewQuery>;
}) {
  const queryData = usePreloadedQuery<SessionDetailsTracesViewQuery>(
    sessionDetailsTracesViewQuery,
    queryRef
  );
  if (queryData.session == null) {
    throw new Error("Session not found");
  }
  const { data, loadNext, isLoadingNext, hasNext } = usePaginationFragment<
    SessionDetailsTracesViewRefetchQuery,
    SessionDetailsTracesView_traces$key
  >(
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
    queryData.session
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
  const selectedTraceId = searchParams.get(SELECTED_TRACE_ID_PARAM);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const initialSelectedTraceIdRef = useRef(selectedTraceId);
  const hasScrolledInitialSelectionRef = useRef(false);
  const initialSelectedTracePagesLoadedRef = useRef(0);

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

  const handleTraceSelect: TraceSelectHandler = ({ traceId, spanNodeId }) => {
    setSearchParams(
      (params) => {
        params.set(SELECTED_TRACE_ID_PARAM, traceId);
        params.set(SELECTED_SPAN_NODE_ID_PARAM, spanNodeId);
        return params;
      },
      { replace: true }
    );
  };

  const handleSpanClick: SpanClickHandler = ({ traceId, spanNodeId }) => {
    handleTraceSelect({ traceId, spanNodeId });
  };

  // The URL can preselect a trace before its paginated row is loaded. Page a
  // bounded amount until that row exists, then expand it once and scroll it into view.
  useEffect(() => {
    const initialSelectedTraceId = initialSelectedTraceIdRef.current;
    if (
      initialSelectedTraceId == null ||
      hasScrolledInitialSelectionRef.current
    ) {
      return;
    }
    const initialSelectedTrace = traces.find(
      (trace) => trace.traceId === initialSelectedTraceId
    );
    if (initialSelectedTrace == null) {
      if (isLoadingNext) {
        return;
      }
      if (
        hasNext &&
        initialSelectedTracePagesLoadedRef.current <
          INITIAL_SELECTED_TRACE_MAX_PAGES
      ) {
        initialSelectedTracePagesLoadedRef.current += 1;
        loadNext(SESSION_DETAILS_PAGE_SIZE);
        return;
      }
      hasScrolledInitialSelectionRef.current = true;
      return;
    }
    const el = rowRefs.current.get(initialSelectedTraceId);
    if (el) {
      setExpandedIds((prev) => {
        if (prev.has(initialSelectedTrace.id)) {
          return prev;
        }
        const next = new Set(prev);
        next.add(initialSelectedTrace.id);
        return next;
      });
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      hasScrolledInitialSelectionRef.current = true;
    }
  }, [hasNext, isLoadingNext, loadNext, traces]);

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "session-traces-view-layout",
    storage: localStorage,
  });

  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        const withinRange = scrollHeight - scrollTop - clientHeight < 1024;
        if (withinRange && !isLoadingNext && hasNext) {
          loadNext(SESSION_DETAILS_PAGE_SIZE);
        }
      }
    },
    [hasNext, isLoadingNext, loadNext]
  );

  const throttledFetchMoreOnBottomReached = useMemo(
    () => throttle(fetchMoreOnBottomReached, 100),
    [fetchMoreOnBottomReached]
  );

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
          <TraceRowList
            traces={traces}
            expandedIds={expandedIds}
            selectedTraceId={selectedTraceId}
            selectedSpanNodeId={selectedSpanNodeId}
            onToggleExpanded={toggleExpanded}
            onTraceSelect={handleTraceSelect}
            onSpanClick={handleSpanClick}
            rowRefs={rowRefs}
            isLoadingNext={isLoadingNext}
            onScroll={(e) =>
              throttledFetchMoreOnBottomReached(e.target as HTMLDivElement)
            }
          />
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
  selectedTraceId,
  selectedSpanNodeId,
  onToggleExpanded,
  onTraceSelect,
  onSpanClick,
  rowRefs,
  isLoadingNext,
  onScroll,
}: {
  traces: SessionTraceRow[];
  expandedIds: Set<string>;
  selectedTraceId: string | null;
  selectedSpanNodeId: string | null;
  onToggleExpanded: (id: string) => void;
  onTraceSelect: TraceSelectHandler;
  onSpanClick: SpanClickHandler;
  rowRefs: { current: Map<string, HTMLDivElement> };
  isLoadingNext: boolean;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      css={traceRowListCSS}
      data-testid="session-trace-row-list"
      onScroll={onScroll}
    >
      {traces.length === 0 ? (
        <EmptyStateArea>
          <EmptyState
            graphic={<EmptyStateGraphic variant="trace" />}
            description="No traces in this session"
          />
        </EmptyStateArea>
      ) : (
        <>
          {traces.map((trace, index) => (
            <TraceRow
              key={trace.id}
              trace={trace}
              index={index}
              isSelected={trace.traceId === selectedTraceId}
              isExpanded={expandedIds.has(trace.id)}
              selectedSpanNodeId={selectedSpanNodeId}
              onToggleExpanded={() => onToggleExpanded(trace.id)}
              onTraceSelect={() =>
                onTraceSelect({
                  traceId: trace.traceId,
                  spanNodeId: trace.rootSpan.id,
                })
              }
              onSpanClick={onSpanClick}
              setTraceRowRef={({ traceId, el }) => {
                if (el) {
                  rowRefs.current.set(traceId, el);
                } else {
                  rowRefs.current.delete(traceId);
                }
              }}
            />
          ))}
          {isLoadingNext && (
            <View
              borderBottomColor="default"
              borderBottomWidth={"thin"}
              padding="size-200"
            >
              <Loading />
            </View>
          )}
        </>
      )}
    </div>
  );
}

function TraceRow({
  trace,
  index,
  isSelected,
  isExpanded,
  selectedSpanNodeId,
  onToggleExpanded,
  onTraceSelect,
  onSpanClick,
  setTraceRowRef,
}: {
  trace: SessionTraceRow;
  index: number;
  isSelected: boolean;
  isExpanded: boolean;
  selectedSpanNodeId: string | null;
  onToggleExpanded: () => void;
  onTraceSelect: () => void;
  onSpanClick: SpanClickHandler;
  setTraceRowRef: ({
    traceId,
    el,
  }: {
    traceId: string;
    el: HTMLDivElement | null;
  }) => void;
}) {
  return (
    <div
      css={traceRowCSS}
      data-selected={isSelected || undefined}
      data-testid="session-trace-row"
      ref={(el) => {
        setTraceRowRef({ traceId: trace.traceId, el });
      }}
    >
      <TraceRowHeader
        trace={trace}
        index={index}
        isSelected={isSelected}
        isExpanded={isExpanded}
        onToggleExpanded={onToggleExpanded}
        onTraceSelect={onTraceSelect}
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
  isSelected,
  isExpanded,
  onToggleExpanded,
  onTraceSelect,
}: {
  trace: SessionTraceRow;
  index: number;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onTraceSelect: () => void;
}) {
  return (
    <button
      type="button"
      css={traceRowHeaderCSS}
      aria-expanded={isExpanded}
      onClick={() => {
        if (!isSelected) {
          onTraceSelect();
          if (!isExpanded) {
            onToggleExpanded();
          }
          return;
        }
        onToggleExpanded();
      }}
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
      <DisclosureArrow isExpanded={isExpanded} />
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
          onSpanClick={({ spanNodeId }) => onSpanClick({ traceId, spanNodeId })}
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
        scrollSelectedSpanIntoView={false}
        onSpanClick={(span) => onSpanClick({ traceId, spanNodeId: span.id })}
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

  &[data-selected="true"] > button {
    background: var(--global-list-item-selected-background-color);
    color: var(--global-text-color-900);
    border-left-color: var(--global-list-item-selected-border-color);
  }
`;

const traceRowHeaderCSS = css`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-200);
  background: transparent;
  border: none;
  /* Reserve space for the selected-state indicator so rows do not shift when selected. */
  border-left: 4px solid transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;
  box-sizing: border-box;

  &:hover {
    background: var(--global-list-item-hover-background-color);
  }
`;

const chevronCSS = css`
  flex: none;
  display: inline-flex;
  align-items: center;
  /* Center the arrow on the title line rather than floating between the
   * title and metrics lines. */
  height: var(--global-line-height-s);
`;

const traceTreeContainerCSS = css`
  max-height: 500px;
  overflow: auto;
  border-top: 1px solid var(--global-border-color-default);
  background: var(--global-color-gray-75);

  /* The tree renders inside a trace row that is itself selected, so tone the
   * span selection down a step — the strong list-item selection color stays
   * on the trace row. */
  & .span-node-wrap.is-selected {
    background-color: var(--global-color-gray-100);
    border-color: var(--global-color-gray-200);
  }
`;

const spanDetailsContainerCSS = css`
  height: 100%;
  overflow: auto;
`;
