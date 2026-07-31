import { css } from "@emotion/react";
import { throttle } from "lodash";
import {
  type ReactNode,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useEffectEvent,
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
import { useLocation, useNavigate } from "react-router";

import { Empty, Flex, Loading, View } from "@phoenix/components";
import {
  SpanDetailPanelAnnotationButton,
  TraceDetailPanelAnnotationButton,
} from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import {
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";
import { TraceSummaryRow } from "@phoenix/components/trace/TraceSummaryRow";
import { TraceTreeProvider } from "@phoenix/components/trace/TraceTree";
import { TraceTreeSkeleton } from "@phoenix/components/trace/TraceTreeSkeleton";
import {
  detailsPanelNavigationRowBackgroundBleedCSS,
  detailsPanelNavigationScrollOwnerCSS,
} from "@phoenix/components/trace/traceTreeStyles";
import type { SpanDetailsPreview } from "@phoenix/components/trace/types";
import { useDetailsPanelNavigationGutterPaint } from "@phoenix/components/trace/useDetailsPanelNavigationGutterPaint";
import {
  SELECTED_SPAN_NODE_ID_PARAM,
  SELECTED_TRACE_ID_PARAM,
  SESSION_VIEW_PARAM,
} from "@phoenix/constants/searchParams";
import type {
  SessionDetailsTracesView_traces$data,
  SessionDetailsTracesView_traces$key,
} from "@phoenix/pages/trace/__generated__/SessionDetailsTracesView_traces.graphql";
import type { SessionDetailsTracesViewQuery } from "@phoenix/pages/trace/__generated__/SessionDetailsTracesViewQuery.graphql";
import type { SessionDetailsTracesViewRefetchQuery } from "@phoenix/pages/trace/__generated__/SessionDetailsTracesViewRefetchQuery.graphql";
import type { SessionDetailsTracesViewSelectedSpanQuery } from "@phoenix/pages/trace/__generated__/SessionDetailsTracesViewSelectedSpanQuery.graphql";
import type { SessionDetailsTracesViewSelectedTraceQuery } from "@phoenix/pages/trace/__generated__/SessionDetailsTracesViewSelectedTraceQuery.graphql";
import type { SessionDetailsTracesViewTreeQuery } from "@phoenix/pages/trace/__generated__/SessionDetailsTracesViewTreeQuery.graphql";
import { SESSION_DETAILS_PAGE_SIZE } from "@phoenix/pages/trace/constants";

import { ConnectedTraceTree } from "./ConnectedTraceTree";
import { DetailsPanelContent } from "./DetailsPanel";
import type {
  SessionMainContentRenderer,
  SessionNavigationHeaderRenderer,
} from "./SessionDetails";
import { SessionDetailsNavigation } from "./SessionDetailsNavigation";
import type { SessionDetailsSearchParamsStore } from "./sessionDetailsSearchParamsStore";
import { getSpanInfoSectionId } from "./span/sectionIds";
import { SpanDetailsPaintGate } from "./SpanDetailsPaintGate";
import { SpanInfoCardsProvider } from "./SpanInfoCardsContext";
import type { RootSpanMessageRole } from "./TraceTurnContent";
import { TraceTurnDetails, TraceTurnDetailsSkeleton } from "./TraceTurnDetails";

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

type TraceSelectHandler = (selection: { traceId: string }) => void;

function SelectedSpanTraceResolver({
  spanNodeId,
  onTraceResolved,
}: {
  spanNodeId: string;
  onTraceResolved: (selection: { spanNodeId: string; traceId: string }) => void;
}) {
  const data = useLazyLoadQuery<SessionDetailsTracesViewSelectedSpanQuery>(
    graphql`
      query SessionDetailsTracesViewSelectedSpanQuery($spanNodeId: ID!) {
        span: node(id: $spanNodeId) {
          __typename
          ... on Span {
            trace {
              traceId
            }
          }
        }
      }
    `,
    { spanNodeId }
  );
  const traceId =
    data.span?.__typename === "Span" ? data.span.trace.traceId : null;
  const notifyTraceResolved = useEffectEvent(onTraceResolved);

  useEffect(() => {
    if (traceId == null) return;
    notifyTraceResolved({ spanNodeId, traceId });
  }, [spanNodeId, traceId]);

  return null;
}

function SelectedTraceDetails({
  onRootSpanDetailsReady,
  onRootSpanResolved,
  onRootSpanSelect,
  onTraceSelect,
  projectId,
  selectedSpanDetails,
  selectedSpanNodeId,
  traceId,
}: {
  onRootSpanDetailsReady: (spanNodeId: string) => void;
  onRootSpanResolved: (selection: {
    spanNodeId: string;
    traceId: string;
  }) => void;
  onRootSpanSelect: SpanClickHandler;
  onTraceSelect: TraceSelectHandler;
  projectId: string;
  selectedSpanDetails: ReactNode;
  selectedSpanNodeId: string | null;
  traceId: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const data = useLazyLoadQuery<SessionDetailsTracesViewSelectedTraceQuery>(
    graphql`
      query SessionDetailsTracesViewSelectedTraceQuery(
        $projectId: ID!
        $traceId: ID!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            trace(traceId: $traceId) {
              id
              traceId
              rootSpans: spans(
                first: 1
                rootSpansOnly: true
                orphanSpanAsRootSpan: true
              ) {
                edges {
                  span: node {
                    id
                    spanId
                    latencyMs
                    startTime
                    cumulativeTokenCountTotal
                    trace {
                      costSummary {
                        total {
                          cost
                        }
                      }
                    }
                    ...TraceTurnContent_rootSpan
                  }
                }
              }
            }
          }
        }
      }
    `,
    { projectId, traceId },
    { fetchPolicy: "store-or-network" }
  );
  const trace = data.project?.trace;
  const rootSpan = trace?.rootSpans.edges[0]?.span;
  const resolvedRootSpanNodeId = rootSpan?.id;
  const resolvedTraceId = trace?.traceId;
  const notifyRootSpanResolved = useEffectEvent(onRootSpanResolved);
  useEffect(() => {
    if (resolvedRootSpanNodeId == null || resolvedTraceId == null) return;
    notifyRootSpanResolved({
      spanNodeId: resolvedRootSpanNodeId,
      traceId: resolvedTraceId,
    });
  }, [resolvedRootSpanNodeId, resolvedTraceId]);
  if (trace == null || rootSpan == null) {
    throw new Error("Trace is required to view trace details");
  }
  const isTraceSelected = selectedSpanNodeId == null;
  if (!isTraceSelected && selectedSpanNodeId !== rootSpan.id) {
    return selectedSpanDetails;
  }
  const handleRootSpanMessageDoubleClick = (role: RootSpanMessageRole) => {
    const nextSearchParams = new URLSearchParams(location.search);
    const sectionKey = role === "INPUT" ? "input" : "output";
    nextSearchParams.set(SESSION_VIEW_PARAM, "traces");
    nextSearchParams.set(SELECTED_TRACE_ID_PARAM, trace.traceId);
    nextSearchParams.set(SELECTED_SPAN_NODE_ID_PARAM, rootSpan.id);
    void navigate({
      pathname: location.pathname,
      search: nextSearchParams.toString(),
      hash: `#${getSpanInfoSectionId({
        sectionKey,
        spanId: rootSpan.spanId,
      })}`,
    });
  };
  return (
    <TraceTurnDetails
      isTraceSelected={isTraceSelected}
      onRootSpanDetailsReady={onRootSpanDetailsReady}
      onRootSpanMessageDoubleClick={handleRootSpanMessageDoubleClick}
      onRootSpanSelect={() =>
        onRootSpanSelect({
          spanNodeId: rootSpan.id,
          traceId: trace.traceId,
        })
      }
      onTraceSelect={() => onTraceSelect({ traceId: trace.traceId })}
      rootSpan={rootSpan}
      traceId={trace.traceId}
      traceNodeId={trace.id}
    />
  );
}

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
  renderMainContent: SessionMainContentRenderer;
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
        project {
          id
        }
        numTraces
        traces(first: $first, after: $after)
          @connection(key: "SessionDetailsTracesView_traces") {
          edges {
            trace: node {
              id
              traceId
              errorCount
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
  const projectId = data.project.id;

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
  const autoExpansionTargetTraceIdRef = useRef<string | null>(null);
  const autoExpansionPagesLoadedRef = useRef(0);
  const lastLocatedTraceIdRef = useRef<string | null>(null);
  const lastAutoExpandedTraceIdRef = useRef<string | null>(null);
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

  const prepareSpanSelection = (selection: {
    spanNodeId: string;
    traceId: string;
  }) => {
    const { spanNodeId } = selection;
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

  const handleTraceSelect: TraceSelectHandler = (selection) => {
    searchParamsStore.selectTrace(selection.traceId);
  };

  const handleSelectedSpanTraceResolved = (selection: {
    spanNodeId: string;
    traceId: string;
  }) => {
    const currentSelection = searchParamsStore.getSpanSelection();
    if (
      currentSelection.spanNodeId !== selection.spanNodeId ||
      currentSelection.traceId != null
    ) {
      return;
    }
    prepareSpanSelection(selection);
  };

  const handleSpanClick: SpanClickHandler = (selection) => {
    prepareSpanSelection(selection);
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

  // A route or external navigation can select a trace before its paginated row
  // is loaded. Page a bounded amount until that row exists, then scroll it into
  // view. Keep trace-only selections collapsed; only expand the row when a span
  // deep link needs the trace tree to reveal its selected span.
  useEffect(() => {
    if (selectedTraceId == null) {
      autoExpansionTargetTraceIdRef.current = null;
      autoExpansionPagesLoadedRef.current = 0;
      lastLocatedTraceIdRef.current = null;
      lastAutoExpandedTraceIdRef.current = null;
      return;
    }
    const shouldLocateTrace = lastLocatedTraceIdRef.current !== selectedTraceId;
    const shouldAutoExpandTrace =
      selectedSpanNodeId != null &&
      lastAutoExpandedTraceIdRef.current !== selectedTraceId;
    if (!shouldLocateTrace && !shouldAutoExpandTrace) {
      return;
    }
    if (autoExpansionTargetTraceIdRef.current !== selectedTraceId) {
      autoExpansionTargetTraceIdRef.current = selectedTraceId;
      autoExpansionPagesLoadedRef.current = 0;
    }
    const selectedTrace = traces.find(
      (trace) => trace.traceId === selectedTraceId
    );
    if (selectedTrace == null) {
      if (isLoadingNext) {
        return;
      }
      if (
        hasNext &&
        autoExpansionPagesLoadedRef.current < INITIAL_SELECTED_TRACE_MAX_PAGES
      ) {
        autoExpansionPagesLoadedRef.current += 1;
        loadNext(SESSION_DETAILS_PAGE_SIZE);
        return;
      }
      lastLocatedTraceIdRef.current = selectedTraceId;
      return;
    }
    const el = rowRefs.current.get(selectedTraceId);
    if (el) {
      if (shouldAutoExpandTrace) {
        startTransition(() => {
          setExpandedIds((prev) => {
            if (prev.has(selectedTrace.id)) {
              return prev;
            }
            const next = new Set(prev);
            next.add(selectedTrace.id);
            return next;
          });
        });
        lastAutoExpandedTraceIdRef.current = selectedTraceId;
      }
      if (shouldLocateTrace) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        lastLocatedTraceIdRef.current = selectedTraceId;
      }
    }
  }, [
    hasNext,
    isLoadingNext,
    loadNext,
    selectedSpanNodeId,
    selectedTraceId,
    traces,
  ]);

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
    <>
      {selectedSpanNodeId != null && selectedTraceId == null ? (
        <Suspense fallback={null}>
          <SelectedSpanTraceResolver
            spanNodeId={selectedSpanNodeId}
            onTraceResolved={handleSelectedSpanTraceResolved}
          />
        </Suspense>
      ) : null}
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
            <SelectionDetailsPanel
              onRootSpanSelect={handleSpanClick}
              onTraceSelect={handleTraceSelect}
              projectId={projectId}
              selectedSpanNodeId={selectedSpanNodeId}
              selectedTraceId={selectedTraceId}
              selectionRequestRef={spanSelectionRequestRef}
              onSpanDetailsReady={handleSpanDetailsReady}
            />,
            {
              isHeaderHidden:
                selectedSpanNodeId != null || selectedTraceId != null,
            }
          )}
        </SpanInfoCardsProvider>
      </DetailsPanelContent>
    </>
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
  const scrollOwnerRef = useRef<HTMLDivElement>(null);
  useDetailsPanelNavigationGutterPaint({ scrollOwnerRef });

  return (
    <div
      ref={scrollOwnerRef}
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
              isActive={trace.traceId === selectedTraceId}
              isSelected={
                trace.traceId === selectedTraceId && selectedSpanNodeId == null
              }
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
  isActive,
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
  isActive: boolean;
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
      data-collapsed-navigation-hover-trigger
      data-selected={isSelected || undefined}
      data-has-active-descendant={(isActive && !isSelected) || undefined}
      data-testid="session-trace-row"
      ref={(el) => {
        setTraceRowRef({ traceId: trace.traceId, el });
      }}
    >
      <TraceSummaryRow
        actions={<TraceDetailPanelAnnotationButton traceNodeId={trace.id} />}
        cost={trace.rootSpan.trace.costSummary?.total?.cost}
        disclosureTestId="session-trace-row-header"
        errorCount={trace.errorCount}
        index={index}
        isActive={isActive}
        isExpanded={isExpanded}
        isSelected={isSelected}
        latencyMs={trace.rootSpan.latencyMs}
        name={trace.rootSpan.name}
        onSelect={onTraceSelect}
        onToggleExpanded={onToggleExpanded}
        startTime={trace.rootSpan.startTime}
        tokenCountTotal={trace.rootSpan.cumulativeTokenCountTotal ?? 0}
        traceId={trace.traceId}
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
      data-navigation-gutter-paint
      data-testid="session-trace-tree"
    >
      <Suspense
        fallback={
          <TraceTreeSkeleton
            isNavigationCollapsed={isNavigationCollapsed}
            isScrollOwner={false}
          />
        }
      >
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

function SelectionDetailsPanel({
  onRootSpanSelect,
  onTraceSelect,
  projectId,
  selectedSpanNodeId,
  selectedTraceId,
  selectionRequestRef,
  onSpanDetailsReady,
}: {
  onRootSpanSelect: SpanClickHandler;
  onTraceSelect: TraceSelectHandler;
  projectId: string;
  selectedSpanNodeId: string | null;
  selectedTraceId: string | null;
  selectionRequestRef: { current: SpanClickHandler };
  onSpanDetailsReady: (spanNodeId: string) => void;
}) {
  const [localSpanSelection, setLocalSpanSelection] = useState<{
    spanNodeId: string;
    spanPreview?: SpanDetailsPreview;
  } | null>(() =>
    selectedSpanNodeId ? { spanNodeId: selectedSpanNodeId } : null
  );
  const [resolvedRootSpan, setResolvedRootSpan] = useState<{
    spanNodeId: string;
    traceId: string;
  } | null>(null);

  useEffect(() => {
    selectionRequestRef.current = ({ spanNodeId, spanPreview }) => {
      setLocalSpanSelection({ spanNodeId, spanPreview });
    };
    return () => {
      selectionRequestRef.current = () => undefined;
    };
  }, [selectionRequestRef]);

  const selectedSpanDetails =
    selectedSpanNodeId == null || localSpanSelection == null ? (
      <Flex
        direction="row"
        alignItems="center"
        justifyContent="center"
        height="100%"
        data-testid="session-span-details-empty"
      >
        <Empty message="Expand a trace and select a span to view its details" />
      </Flex>
    ) : (
      <div css={spanDetailsContainerCSS} data-testid="session-span-details">
        <SpanDetailsPaintGate
          spanNodeId={selectedSpanNodeId}
          spanPreview={
            localSpanSelection.spanNodeId === selectedSpanNodeId
              ? localSpanSelection.spanPreview
              : undefined
          }
          onSpanDetailsReady={onSpanDetailsReady}
        />
      </div>
    );

  const resolvedRootSpanNodeId =
    resolvedRootSpan?.traceId === selectedTraceId
      ? resolvedRootSpan.spanNodeId
      : null;
  const shouldRenderSelectedTraceDetails =
    selectedTraceId != null &&
    (selectedSpanNodeId == null ||
      selectedSpanNodeId === resolvedRootSpanNodeId);

  return shouldRenderSelectedTraceDetails ? (
    <Suspense fallback={<TraceTurnDetailsSkeleton />}>
      <SelectedTraceDetails
        onRootSpanDetailsReady={onSpanDetailsReady}
        onRootSpanResolved={setResolvedRootSpan}
        onRootSpanSelect={onRootSpanSelect}
        onTraceSelect={onTraceSelect}
        projectId={projectId}
        selectedSpanDetails={selectedSpanDetails}
        selectedSpanNodeId={selectedSpanNodeId}
        traceId={selectedTraceId}
      />
    </Suspense>
  ) : (
    selectedSpanDetails
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
        isHoverOverlayEnabled={false}
        isNavigationCollapsed={isNavigationCollapsed}
        isScrollOwner={false}
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
        renderSpanActions={(span) => (
          <SpanDetailPanelAnnotationButton spanNodeId={span.id} />
        )}
      />
    </TraceTreeProvider>
  );
}

const traceRowListCSS = css`
  ${detailsPanelNavigationScrollOwnerCSS}
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
`;

const traceRowCSS = css`
  display: flex;
  flex-direction: column;
`;

const traceTreeContainerCSS = css`
  ${detailsPanelNavigationRowBackgroundBleedCSS}
  --details-panel-navigation-row-bleed-background-color: var(
    --global-color-gray-75
  );
  background: var(--global-color-gray-75);
  --trace-tree-row-background-color: var(--global-color-gray-75);
  --trace-tree-show-more-background-color: var(--global-color-gray-75);
`;

const spanDetailsContainerCSS = css`
  height: 100%;
  overflow: hidden;
`;
