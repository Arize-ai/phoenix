import { css } from "@emotion/react";
import { throttle } from "lodash";
import {
  type ReactNode,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { PreloadedQuery } from "react-relay";
import {
  graphql,
  useLazyLoadQuery,
  usePaginationFragment,
  usePreloadedQuery,
} from "react-relay";

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
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { TraceTreeProvider } from "@phoenix/components/trace/TraceTree";
import { TraceTreeSkeleton } from "@phoenix/components/trace/TraceTreeSkeleton";
import type { SpanDetailsPreview } from "@phoenix/components/trace/types";
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
import { DetailsPanelContent } from "./DetailsPanel";
import type { SessionNavigationHeaderRenderer } from "./SessionDetails";
import { SessionDetailsNavigation } from "./SessionDetailsNavigation";
import type { SessionDetailsSearchParamsStore } from "./sessionDetailsSearchParamsStore";
import { SpanDetailsPaintGate } from "./SpanDetailsPaintGate";
import { SpanInfoCardsProvider } from "./SpanInfoCardsContext";

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
  spanPreview,
}: {
  traceId: string;
  spanNodeId: string;
  spanPreview?: SpanDetailsPreview;
}) => void;

type TraceSelectHandler = SpanClickHandler;

export function SessionDetailsTracesView({
  queryRef,
  renderNavigationHeader,
  sessionViewControl,
  isTreePanelCollapsed,
  isNavigationPointerOpen,
  onNavigationPointerOpenChange,
  renderMainContent,
  searchParamsStore,
}: {
  queryRef: PreloadedQuery<SessionDetailsTracesViewQuery>;
  renderNavigationHeader: SessionNavigationHeaderRenderer;
  sessionViewControl: ReactNode;
  isTreePanelCollapsed: boolean;
  isNavigationPointerOpen: boolean;
  onNavigationPointerOpenChange: (isOpen: boolean) => void;
  renderMainContent: (content: ReactNode) => ReactNode;
  searchParamsStore: SessionDetailsSearchParamsStore;
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
  const [
    isTraceTreeChildTruncationEnabled,
    setIsTraceTreeChildTruncationEnabled,
  ] = useState(true);
  // Render the staged selection before detail hydration finishes and commits
  // it to the URL. Reading the store without subscribing left the tree stale
  // until that delayed route update happened.
  const { spanNodeId: selectedSpanNodeId, traceId: selectedTraceId } =
    useSyncExternalStore(
      searchParamsStore.subscribeToSpanSelection,
      searchParamsStore.getSpanSelection,
      searchParamsStore.getSpanSelection
    );
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const initialSelectedTraceIdRef = useRef(selectedTraceId);
  const hasScrolledInitialSelectionRef = useRef(false);
  const initialSelectedTracePagesLoadedRef = useRef(0);
  const spanSelectionRequestRef = useRef<SpanClickHandler>(() => undefined);
  const pendingUrlSelectionRef = useRef<Parameters<SpanClickHandler>[0] | null>(
    null
  );

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

  const areAllTraceRowsExpanded =
    traces.length > 0 && traces.every((trace) => expandedIds.has(trace.id));
  const handleAllTraceRowsCollapsedChange = (isCollapsed: boolean) => {
    startTransition(() => {
      setIsTraceTreeChildTruncationEnabled(isCollapsed);
      setExpandedIds(
        isCollapsed ? new Set() : new Set(traces.map((trace) => trace.id))
      );
    });
  };

  const synchronizePendingSelection = (spanNodeId: string) => {
    const pendingSelection = pendingUrlSelectionRef.current;
    if (pendingSelection?.spanNodeId !== spanNodeId) return;
    pendingUrlSelectionRef.current = null;
    searchParamsStore.synchronizeSpanSelection(pendingSelection);
  };

  const handleTraceSelect: TraceSelectHandler = (selection) => {
    const { spanNodeId } = selection;
    spanSelectionRequestRef.current(selection);
    pendingUrlSelectionRef.current = selection;
    searchParamsStore.prepareSpanSelection(selection);

    const escapedSpanNodeId = CSS.escape(spanNodeId);
    const retainedDetailsAreReady = document.querySelector(
      `[data-span-details-retained-id="${escapedSpanNodeId}"]:not([hidden]) [data-span-details-body-id="${escapedSpanNodeId}"]`
    );
    if (retainedDetailsAreReady) {
      requestAnimationFrame(() => synchronizePendingSelection(spanNodeId));
    }
  };

  const handleSpanClick: SpanClickHandler = (selection) => {
    handleTraceSelect(selection);
  };

  const handleSpanSelectionStart: SpanClickHandler = (selection) => {
    spanSelectionRequestRef.current(selection);
  };

  useEffect(() => {
    return searchParamsStore.subscribeToExternalSelection((selection) => {
      if (selection.spanNodeId && selection.traceId) {
        spanSelectionRequestRef.current({
          spanNodeId: selection.spanNodeId,
          traceId: selection.traceId,
        });
      }
    });
  }, [searchParamsStore]);

  const handleSpanDetailsReady = (spanNodeId: string) => {
    synchronizePendingSelection(spanNodeId);
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
    <DetailsPanelContent
      navigation={
        <>
          {renderNavigationHeader({
            isAllCollapsed: !areAllTraceRowsExpanded,
            onAllCollapsedChange: handleAllTraceRowsCollapsedChange,
          })}
          <SessionDetailsNavigation
            control={sessionViewControl}
            isCollapsed={isTreePanelCollapsed}
            isPointerOpen={isNavigationPointerOpen}
            onPointerOpenChange={onNavigationPointerOpenChange}
          >
            {({ isOverlayOpen }) => (
              <TraceRowList
                traces={traces}
                expandedIds={expandedIds}
                selectedTraceId={selectedTraceId}
                selectedSpanNodeId={selectedSpanNodeId}
                isNavigationCollapsed={isTreePanelCollapsed && !isOverlayOpen}
                isTraceTreeChildTruncationEnabled={
                  isTraceTreeChildTruncationEnabled
                }
                onToggleExpanded={toggleExpanded}
                onTraceSelect={handleTraceSelect}
                onSpanClick={handleSpanClick}
                onSpanSelectionStart={handleSpanSelectionStart}
                rowRefs={rowRefs}
                isLoadingNext={isLoadingNext}
                onScroll={(event) =>
                  throttledFetchMoreOnBottomReached(event.currentTarget)
                }
              />
            )}
          </SessionDetailsNavigation>
        </>
      }
    >
      <SpanInfoCardsProvider>
        {renderMainContent(
          <SpanDetailsPanel
            selectedSpanNodeId={selectedSpanNodeId}
            selectionRequestRef={spanSelectionRequestRef}
            onSpanDetailsReady={handleSpanDetailsReady}
          />
        )}
      </SpanInfoCardsProvider>
    </DetailsPanelContent>
  );
}

function TraceRowList({
  traces,
  expandedIds,
  selectedTraceId,
  selectedSpanNodeId,
  isNavigationCollapsed,
  isTraceTreeChildTruncationEnabled,
  onToggleExpanded,
  onTraceSelect,
  onSpanClick,
  onSpanSelectionStart,
  rowRefs,
  isLoadingNext,
  onScroll,
}: {
  traces: SessionTraceRow[];
  expandedIds: Set<string>;
  selectedTraceId: string | null;
  selectedSpanNodeId: string | null;
  isNavigationCollapsed: boolean;
  isTraceTreeChildTruncationEnabled: boolean;
  onToggleExpanded: (id: string) => void;
  onTraceSelect: TraceSelectHandler;
  onSpanClick: SpanClickHandler;
  onSpanSelectionStart: SpanClickHandler;
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
              isNavigationCollapsed={isNavigationCollapsed}
              isTraceTreeChildTruncationEnabled={
                isTraceTreeChildTruncationEnabled
              }
              onToggleExpanded={() => onToggleExpanded(trace.id)}
              onTraceSelect={() =>
                onTraceSelect({
                  traceId: trace.traceId,
                  spanNodeId: trace.rootSpan.id,
                  spanPreview: {
                    ...trace.rootSpan,
                    projectId: trace.rootSpan.project.id,
                    traceId: trace.traceId,
                  },
                })
              }
              onSpanClick={onSpanClick}
              onSpanSelectionStart={onSpanSelectionStart}
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
  isNavigationCollapsed,
  isTraceTreeChildTruncationEnabled,
  onToggleExpanded,
  onTraceSelect,
  onSpanClick,
  onSpanSelectionStart,
  setTraceRowRef,
}: {
  trace: SessionTraceRow;
  index: number;
  isSelected: boolean;
  isExpanded: boolean;
  selectedSpanNodeId: string | null;
  isNavigationCollapsed: boolean;
  isTraceTreeChildTruncationEnabled: boolean;
  onToggleExpanded: () => void;
  onTraceSelect: () => void;
  onSpanClick: SpanClickHandler;
  onSpanSelectionStart: SpanClickHandler;
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
          isNavigationCollapsed={isNavigationCollapsed}
          isTraceTreeChildTruncationEnabled={isTraceTreeChildTruncationEnabled}
          onSpanClick={onSpanClick}
          onSpanSelectionStart={onSpanSelectionStart}
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
  const paddedIndex = String(index + 1).padStart(2, "0");
  return (
    <button
      type="button"
      className="session-trace-row-header"
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
      <Text
        className="session-trace-row-header__compact-index"
        fontFamily="mono"
        color="text-500"
      >
        {paddedIndex}
      </Text>
      <TraceRowChevron isExpanded={isExpanded} />
      <Flex
        className="session-trace-row-header__expanded-content"
        direction="column"
        gap="size-100"
        flex={1}
        minWidth={0}
      >
        <TraceRowTitleLine trace={trace} index={index} />
        <TraceRowMetricsLine trace={trace} />
      </Flex>
    </button>
  );
}

function TraceRowChevron({ isExpanded }: { isExpanded: boolean }) {
  return (
    <span
      className="session-trace-row-chevron"
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
  isNavigationCollapsed,
  isTraceTreeChildTruncationEnabled,
  onSpanClick,
  onSpanSelectionStart,
}: {
  traceId: string;
  projectId: string;
  selectedSpanNodeId: string | null;
  isNavigationCollapsed: boolean;
  isTraceTreeChildTruncationEnabled: boolean;
  onSpanClick: SpanClickHandler;
  onSpanSelectionStart: SpanClickHandler;
}) {
  return (
    <div
      className="session-trace-tree"
      css={traceTreeContainerCSS}
      data-testid="session-trace-tree"
    >
      <Suspense fallback={<TraceTreeSkeleton />}>
        <LazyTraceTree
          traceId={traceId}
          projectId={projectId}
          selectedSpanNodeId={selectedSpanNodeId}
          isNavigationCollapsed={isNavigationCollapsed}
          isTraceTreeChildTruncationEnabled={isTraceTreeChildTruncationEnabled}
          onSpanClick={onSpanClick}
          onSpanSelectionStart={onSpanSelectionStart}
        />
      </Suspense>
    </div>
  );
}

function SpanDetailsPanel({
  selectedSpanNodeId,
  selectionRequestRef,
  onSpanDetailsReady,
}: {
  selectedSpanNodeId: string | null;
  selectionRequestRef: { current: SpanClickHandler };
  onSpanDetailsReady: (spanNodeId: string) => void;
}) {
  const [localSpanSelection, setLocalSpanSelection] = useState<{
    spanNodeId: string;
    spanPreview?: SpanDetailsPreview;
  } | null>(() =>
    selectedSpanNodeId ? { spanNodeId: selectedSpanNodeId } : null
  );

  useEffect(() => {
    selectionRequestRef.current = ({ spanNodeId, spanPreview }) => {
      setLocalSpanSelection({ spanNodeId, spanPreview });
    };
    return () => {
      selectionRequestRef.current = () => undefined;
    };
  }, [selectionRequestRef]);

  if (!localSpanSelection) {
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
      <SpanDetailsPaintGate
        spanNodeId={localSpanSelection.spanNodeId}
        spanPreview={localSpanSelection.spanPreview}
        onSpanDetailsReady={onSpanDetailsReady}
        showSessionHeader={false}
      />
    </div>
  );
}

function LazyTraceTree({
  traceId,
  projectId,
  selectedSpanNodeId,
  isNavigationCollapsed,
  isTraceTreeChildTruncationEnabled,
  onSpanClick,
  onSpanSelectionStart,
}: {
  traceId: string;
  projectId: string;
  selectedSpanNodeId: string | null;
  isNavigationCollapsed: boolean;
  isTraceTreeChildTruncationEnabled: boolean;
  onSpanClick: SpanClickHandler;
  onSpanSelectionStart: SpanClickHandler;
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
        isChildTruncationEnabled={isTraceTreeChildTruncationEnabled}
        isNavigationCollapsed={isNavigationCollapsed}
        selectedSpanNodeId={selectedSpanNodeId ?? ""}
        scrollSelectedSpanIntoView={false}
        onSpanClick={(span) =>
          onSpanClick({
            traceId,
            spanNodeId: span.id,
            spanPreview: { ...span, projectId, traceId },
          })
        }
        onSpanSelectionStart={(span) =>
          onSpanSelectionStart({
            traceId,
            spanNodeId: span.id,
            spanPreview: { ...span, projectId, traceId },
          })
        }
      />
    </TraceTreeProvider>
  );
}

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
  position: relative;
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
  border-top: 1px solid var(--global-border-color-default);
  background: var(--global-color-gray-75);
  --trace-tree-show-more-background-color: var(--global-color-gray-75);

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
  overflow: hidden;
`;
