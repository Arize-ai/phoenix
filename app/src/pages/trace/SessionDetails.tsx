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

import { Flex, IDBadge, Loading, Text, View } from "@phoenix/components";
import { SessionDetailPanelAnnotationBar } from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import { ExpandCollapseAllButton } from "@phoenix/components/trace/ExpandCollapseAllButton";
import { SESSION_DETAILS_PAGE_SIZE } from "@phoenix/pages/trace/constants";

import type { SessionDetailsQuery } from "./__generated__/SessionDetailsQuery.graphql";
import type { SessionDetailsTraceListQuery } from "./__generated__/SessionDetailsTraceListQuery.graphql";
import type { SessionDetailsTracesViewQuery } from "./__generated__/SessionDetailsTracesViewQuery.graphql";
import { DetailsPanelNavigationControlsRow } from "./DetailsPanel";
import {
  createSessionDetailsSearchParamsStore,
  type SessionDetailsSearchParamsStore,
} from "./sessionDetailsSearchParamsStore";
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

export type SessionDetailsProps = {
  sessionId: string;
  sessionDisplayId: string;
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
}: PropsWithChildren<{ sessionId: string; sessionDisplayId: string }>) {
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
      <View
        paddingTop="size-100"
        paddingBottom="size-100"
        paddingStart="size-150"
        paddingEnd="size-200"
        flex="none"
      >
        <Flex direction="column" gap="size-50" width="100%">
          <Flex direction="row" alignItems="center" gap="size-100" minWidth={0}>
            <Text size="L" weight="heavy">
              Session
            </Text>
          </Flex>
          <Flex
            direction="row"
            alignItems="center"
            gap="size-100"
            minWidth={0}
            wrap
          >
            <IDBadge id={sessionDisplayId} tooltipText="Copy Session ID" />
          </Flex>
        </Flex>
      </View>
      <Suspense fallback={null}>
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
  sessionDisplayId,
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
  const data = useLazyLoadQuery<SessionDetailsQuery>(
    graphql`
      query SessionDetailsQuery($id: ID!) {
        session: node(id: $id) {
          ... on ProjectSession {
            numTraces
          }
        }
      }
    `,
    {
      id: sessionId,
    },
    {
      fetchPolicy: "store-and-network",
    }
  );

  if (data.session == null) {
    throw new Error("Session not found");
  }
  const traceCount = data.session.numTraces ?? 0;
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
      <SessionViewControl
        sessionView={sessionView}
        onSessionViewChange={handleSessionViewChange}
        traceCount={traceCount}
      />
    </>
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
      <Suspense fallback={<Loading />}>
        {sessionView === "traces"
          ? tracesViewQueryRef != null && (
              <SessionDetailsTracesView
                queryRef={tracesViewQueryRef}
                preferredTreeWidth={preferredTreeWidth}
                onPreferredTreeWidthChange={onPreferredTreeWidthChange}
                renderNavigationHeader={renderNavigationHeader}
                renderMainContent={renderMainContent}
                searchParamsStore={searchParamsStore}
              />
            )
          : traceListQueryRef != null && (
              <SessionDetailsTraceList
                queryRef={traceListQueryRef}
                preferredTreeWidth={preferredTreeWidth}
                onPreferredTreeWidthChange={onPreferredTreeWidthChange}
                renderNavigationHeader={renderNavigationHeader}
                renderMainContent={renderMainContent}
              />
            )}
      </Suspense>
    </main>
  );
}
