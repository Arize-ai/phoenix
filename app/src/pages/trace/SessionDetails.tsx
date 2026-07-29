import { css } from "@emotion/react";
import {
  type PropsWithChildren,
  type ReactNode,
  Suspense,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { graphql, useLazyLoadQuery, useQueryLoader } from "react-relay";
import { useSearchParams } from "react-router";

import { SessionDetailPanelAnnotationBar } from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import { ExpandCollapseAllButton } from "@phoenix/components/trace/ExpandCollapseAllButton";
import { SESSION_DETAILS_PAGE_SIZE } from "@phoenix/pages/trace/constants";

import type { SessionDetailsQuery } from "./__generated__/SessionDetailsQuery.graphql";
import type { SessionDetailsTraceListQuery } from "./__generated__/SessionDetailsTraceListQuery.graphql";
import type { SessionDetailsTracesViewQuery } from "./__generated__/SessionDetailsTracesViewQuery.graphql";
import { DetailsPanelNavigationControlsRow } from "./DetailsPanel";
import { SessionDetailsHeader } from "./SessionDetailsHeader";
import {
  createSessionDetailsSearchParamsStore,
  type SessionDetailsSearchParamsStore,
} from "./sessionDetailsSearchParamsStore";
import { SessionDetailsSkeleton } from "./SessionDetailsSkeleton";
import {
  SessionDetailsTraceList,
  sessionDetailsTraceListQuery,
} from "./SessionDetailsTraceList";
import {
  SessionDetailsTracesView,
  sessionDetailsTracesViewQuery,
} from "./SessionDetailsTracesView";
import type { SessionView } from "./SessionViewTabs";
import { isSessionView, SessionViewControl } from "./SessionViewTabs";
import { DetailPanelAnnotationBarSkeleton } from "./TraceDetailsSkeleton";

export type SessionDetailsProps = {
  sessionId: string;
  preferredTreeWidth: number;
  onPreferredTreeWidthChange: (width: number) => void;
  isTreePanelCollapsed: boolean;
  onTreePanelCollapsedChange: (isCollapsed: boolean) => void;
  navigationHeader: ReactNode;
};

export type SessionNavigationHeaderRenderer = (options?: {
  isAllCollapsed: boolean;
  onAllCollapsedChange: (isCollapsed: boolean) => void;
}) => ReactNode;

const DEFAULT_SESSION_VIEW: SessionView = "turns";

function SessionDetailsMainContent({
  children,
  sessionId,
  sessionDisplayId,
  tokenCountTotal,
  totalCost,
}: PropsWithChildren<{
  sessionId: string;
  sessionDisplayId: string;
  tokenCountTotal: number;
  totalCost: number | null;
}>) {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        overflow: hidden;
      `}
    >
      <SessionDetailsHeader
        preview={{
          sessionId,
          sessionDisplayId,
          tokenCountTotal,
          totalCost,
        }}
      />
      <Suspense fallback={<DetailPanelAnnotationBarSkeleton />}>
        <SessionDetailPanelAnnotationBar sessionNodeId={sessionId} />
      </Suspense>
      <div
        css={css`
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;
        `}
      >
        {children}
      </div>
    </div>
  );
}

function SessionDetailsSearchParamsBridge({
  store,
}: {
  store: SessionDetailsSearchParamsStore;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    store.connectToRouter(searchParams, setSearchParams);
  }, [searchParams, setSearchParams, store]);
  return null;
}

/**
 * A component that shows the details of a session
 */
export function SessionDetails({
  sessionId,
  preferredTreeWidth,
  onPreferredTreeWidthChange,
  isTreePanelCollapsed,
  onTreePanelCollapsedChange,
  navigationHeader,
}: SessionDetailsProps) {
  const [searchParamsStore] = useState(() =>
    createSessionDetailsSearchParamsStore(
      new URLSearchParams(window.location.search)
    )
  );
  const sessionViewParam = useSyncExternalStore(
    searchParamsStore.subscribeToSessionView,
    searchParamsStore.getSessionViewParam,
    searchParamsStore.getSessionViewParam
  );
  const sessionView: SessionView = isSessionView(sessionViewParam)
    ? sessionViewParam
    : DEFAULT_SESSION_VIEW;
  // The view branches below replace their navigation DOM. Keep pointer
  // ownership here so a stationary hover survives that replacement.
  const [isNavigationPointerOpen, setIsNavigationPointerOpen] = useState(false);
  const data = useLazyLoadQuery<SessionDetailsQuery>(
    graphql`
      query SessionDetailsQuery($id: ID!) {
        session: node(id: $id) {
          __typename
          ... on ProjectSession {
            numTraces
            sessionId
            tokenUsage {
              total
            }
            costSummary {
              total {
                cost
              }
            }
          }
        }
      }
    `,
    {
      id: sessionId,
    },
    {
      fetchPolicy: "store-or-network",
    }
  );

  if (data.session?.__typename !== "ProjectSession") {
    throw new Error("Session not found");
  }
  const traceCount = data.session.numTraces ?? 0;
  const sessionDisplayId = data.session.sessionId;
  const tokenCountTotal = data.session.tokenUsage.total;
  const totalCost = data.session.costSummary.total.cost;
  const [traceListQueryRef, loadTraceListQuery] =
    useQueryLoader<SessionDetailsTraceListQuery>(sessionDetailsTraceListQuery);
  const [tracesViewQueryRef, loadTracesViewQuery] =
    useQueryLoader<SessionDetailsTracesViewQuery>(
      sessionDetailsTracesViewQuery
    );
  const [, startViewTransition] = useTransition();
  const loadedSessionIdsByViewRef = useRef<
    Partial<Record<SessionView, string>>
  >({});

  const loadQueryForSessionView = (view: SessionView) => {
    if (loadedSessionIdsByViewRef.current[view] === sessionId) {
      return;
    }
    loadedSessionIdsByViewRef.current[view] = sessionId;
    if (view === "traces") {
      loadTracesViewQuery({
        id: sessionId,
        first: SESSION_DETAILS_PAGE_SIZE,
      });
      return;
    }
    loadTraceListQuery({
      id: sessionId,
      first: SESSION_DETAILS_PAGE_SIZE,
    });
  };
  const loadInitialQueryForSessionView = useEffectEvent(
    loadQueryForSessionView
  );

  useEffect(() => {
    if (isSessionView(sessionViewParam)) {
      return;
    }
    searchParamsStore.setSessionViewParam(DEFAULT_SESSION_VIEW);
  }, [searchParamsStore, sessionViewParam]);

  // Keep the currently visible session view routable. We preload the target
  // query before swapping tabs so the current view stays mounted while the
  // next one fetches, avoiding a blank state during the transition.
  useEffect(() => {
    loadInitialQueryForSessionView(sessionView);
  }, [sessionId, sessionView]);

  const handleSessionViewChange = (view: SessionView) => {
    if (view === sessionView) {
      return;
    }
    startViewTransition(() => {
      loadQueryForSessionView(view);
    });
    searchParamsStore.setSessionViewParam(view);
  };
  const renderMainContent = (content: ReactNode) => (
    <SessionDetailsMainContent
      sessionId={sessionId}
      sessionDisplayId={sessionDisplayId}
      tokenCountTotal={tokenCountTotal}
      totalCost={totalCost}
    >
      {content}
    </SessionDetailsMainContent>
  );
  const renderNavigationHeader: SessionNavigationHeaderRenderer = (options) => (
    <>
      {navigationHeader}
      <DetailsPanelNavigationControlsRow
        isCollapsed={isTreePanelCollapsed}
        onCollapsedChange={onTreePanelCollapsedChange}
      >
        {options ? (
          <ExpandCollapseAllButton
            className="details-panel-navigation-controls__expand-collapse-all"
            contentLabel="traces"
            isCollapsed={options.isAllCollapsed}
            onCollapsedChange={options.onAllCollapsedChange}
          />
        ) : null}
      </DetailsPanelNavigationControlsRow>
    </>
  );
  const sessionViewControl = (
    <SessionViewControl
      sessionView={sessionView}
      onSessionViewChange={handleSessionViewChange}
      traceCount={traceCount}
    />
  );
  const loadingState = (
    <SessionDetailsSkeleton
      isTreePanelCollapsed={isTreePanelCollapsed}
      navigationHeader={navigationHeader}
      onPreferredTreeWidthChange={onPreferredTreeWidthChange}
      onSessionViewChange={handleSessionViewChange}
      onTreePanelCollapsedChange={onTreePanelCollapsedChange}
      preferredTreeWidth={preferredTreeWidth}
      preview={{
        sessionId,
        sessionDisplayId,
        traceCount,
        tokenCountTotal,
        totalCost,
      }}
      sessionView={sessionView}
    />
  );

  return (
    <main
      css={css`
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      `}
    >
      <SessionDetailsSearchParamsBridge store={searchParamsStore} />
      <Suspense fallback={loadingState}>
        {sessionView === "traces" ? (
          tracesViewQueryRef != null ? (
            <SessionDetailsTracesView
              queryRef={tracesViewQueryRef}
              preferredTreeWidth={preferredTreeWidth}
              onPreferredTreeWidthChange={onPreferredTreeWidthChange}
              renderNavigationHeader={renderNavigationHeader}
              sessionViewControl={sessionViewControl}
              isTreePanelCollapsed={isTreePanelCollapsed}
              isNavigationPointerOpen={isNavigationPointerOpen}
              onNavigationPointerOpenChange={setIsNavigationPointerOpen}
              renderMainContent={renderMainContent}
              searchParamsStore={searchParamsStore}
            />
          ) : (
            loadingState
          )
        ) : traceListQueryRef != null ? (
          <SessionDetailsTraceList
            queryRef={traceListQueryRef}
            preferredTreeWidth={preferredTreeWidth}
            onPreferredTreeWidthChange={onPreferredTreeWidthChange}
            renderNavigationHeader={renderNavigationHeader}
            sessionViewControl={sessionViewControl}
            isTreePanelCollapsed={isTreePanelCollapsed}
            isNavigationPointerOpen={isNavigationPointerOpen}
            onNavigationPointerOpenChange={setIsNavigationPointerOpen}
            renderMainContent={renderMainContent}
          />
        ) : (
          loadingState
        )}
      </Suspense>
    </main>
  );
}
