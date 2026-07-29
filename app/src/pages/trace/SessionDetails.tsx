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

import { Icon, Icons } from "@phoenix/components";
import {
  SessionDetailPanelAnnotationBar,
  SessionDetailPanelAnnotationButton,
} from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import { ExpandCollapseAllButton } from "@phoenix/components/trace/ExpandCollapseAllButton";
import { TRACE_TREE_ROW_SELECTION_BORDER_WIDTH } from "@phoenix/components/trace/traceTreeStyles";
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
  isTreePanelCollapsed: boolean;
  isNavigationPointerOpen: boolean;
  onNavigationPointerOpenChange: (isOpen: boolean) => void;
  onTreePanelCollapsedChange: (isCollapsed: boolean) => void;
  navigationHeader: ReactNode;
};

export type SessionNavigationHeaderRenderer = (options?: {
  isAllCollapsed: boolean;
  onAllCollapsedChange: (isCollapsed: boolean) => void;
}) => ReactNode;

export type SessionMainContentRenderer = (
  content: ReactNode,
  options?: { isHeaderHidden?: boolean }
) => ReactNode;

const DEFAULT_SESSION_VIEW: SessionView = "turns";

const sessionNavigationAnnotationRowCSS = css`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--global-details-panel-navigation-row-height);
  gap: var(--global-dimension-size-100);
  padding: 0 var(--global-dimension-size-100);
  padding-left: var(
    --global-details-panel-navigation-row-content-padding-inline-start
  );
  border-left: ${TRACE_TREE_ROW_SELECTION_BORDER_WIDTH} solid
    var(--global-color-gray-300);
  background-color: rgba(var(--global-color-gray-200-rgb), 0.5);
  overflow: hidden;

  .session-navigation-annotation-row__icon {
    display: inline-flex;
    flex: none;
  }

  .session-navigation-annotation-row__expanded-content {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    min-width: 0;
  }

  .session-navigation-annotation-row__action {
    display: flex;
    flex: none;
    margin-left: auto;
  }
`;

function SessionDetailsMainContent({
  children,
  isHeaderHidden = false,
  sessionId,
  sessionDisplayId,
  tokenCountTotal,
  totalCost,
}: PropsWithChildren<{
  isHeaderHidden?: boolean;
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
      {isHeaderHidden ? null : (
        <SessionDetailsHeader
          annotationBar={
            <Suspense
              fallback={
                <DetailPanelAnnotationBarSkeleton variant="detail-header" />
              }
            >
              <SessionDetailPanelAnnotationBar sessionNodeId={sessionId} />
            </Suspense>
          }
          preview={{
            sessionId,
            sessionDisplayId,
            tokenCountTotal,
            totalCost,
          }}
        />
      )}
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
  isTreePanelCollapsed,
  isNavigationPointerOpen,
  onNavigationPointerOpenChange,
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
  const renderMainContent: SessionMainContentRenderer = (content, options) => (
    <SessionDetailsMainContent
      isHeaderHidden={options?.isHeaderHidden}
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
    <>
      <SessionViewControl
        sessionView={sessionView}
        onSessionViewChange={handleSessionViewChange}
        traceCount={traceCount}
      />
      <div
        className="session-navigation-annotation-row"
        css={sessionNavigationAnnotationRowCSS}
        onPointerEnter={() => onNavigationPointerOpenChange(true)}
      >
        <span className="session-navigation-annotation-row__icon">
          <Icon aria-hidden="true" svg={<Icons.MessagesSquare />} />
        </span>
        <span className="session-navigation-annotation-row__expanded-content">
          <span>Session</span>
          <span className="session-navigation-annotation-row__action">
            <SessionDetailPanelAnnotationButton sessionNodeId={sessionId} />
          </span>
        </span>
      </div>
    </>
  );
  const loadingState = (
    <SessionDetailsSkeleton
      isTreePanelCollapsed={isTreePanelCollapsed}
      isNavigationPointerOpen={isNavigationPointerOpen}
      navigationHeader={navigationHeader}
      onNavigationPointerOpenChange={onNavigationPointerOpenChange}
      onSessionViewChange={handleSessionViewChange}
      onTreePanelCollapsedChange={onTreePanelCollapsedChange}
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
    <>
      <SessionDetailsSearchParamsBridge store={searchParamsStore} />
      <Suspense fallback={loadingState}>
        {sessionView === "traces" ? (
          tracesViewQueryRef != null ? (
            <SessionDetailsTracesView
              queryRef={tracesViewQueryRef}
              renderNavigationHeader={renderNavigationHeader}
              sessionViewControl={sessionViewControl}
              isTreePanelCollapsed={isTreePanelCollapsed}
              isNavigationPointerOpen={isNavigationPointerOpen}
              onNavigationPointerOpenChange={onNavigationPointerOpenChange}
              renderMainContent={renderMainContent}
              searchParamsStore={searchParamsStore}
            />
          ) : (
            loadingState
          )
        ) : traceListQueryRef != null ? (
          <SessionDetailsTraceList
            queryRef={traceListQueryRef}
            renderNavigationHeader={renderNavigationHeader}
            sessionViewControl={sessionViewControl}
            isTreePanelCollapsed={isTreePanelCollapsed}
            isNavigationPointerOpen={isNavigationPointerOpen}
            onNavigationPointerOpenChange={onNavigationPointerOpenChange}
            renderMainContent={renderMainContent}
          />
        ) : (
          loadingState
        )}
      </Suspense>
    </>
  );
}
