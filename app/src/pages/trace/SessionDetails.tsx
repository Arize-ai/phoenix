import { css } from "@emotion/react";
import { Suspense, useCallback, useEffect, useRef, useTransition } from "react";
import { graphql, useLazyLoadQuery, useQueryLoader } from "react-relay";
import { useSearchParams } from "react-router";

import { Flex, Loading } from "@phoenix/components";
import { SessionDetailPanelAnnotationBar } from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import { SESSION_VIEW_PARAM } from "@phoenix/constants/searchParams";
import { SESSION_DETAILS_PAGE_SIZE } from "@phoenix/pages/trace/constants";

import type { SessionDetailsQuery } from "./__generated__/SessionDetailsQuery.graphql";
import type { SessionDetailsTraceListQuery } from "./__generated__/SessionDetailsTraceListQuery.graphql";
import type { SessionDetailsTracesViewQuery } from "./__generated__/SessionDetailsTracesViewQuery.graphql";
import { SessionAnnotationsTable } from "./SessionAnnotationsTable";
import {
  SessionDetailsTraceList,
  sessionDetailsTraceListQuery,
} from "./SessionDetailsTraceList";
import {
  SessionDetailsTracesView,
  sessionDetailsTracesViewQuery,
} from "./SessionDetailsTracesView";
import type { SessionView } from "./SessionViewTabs";
import { isSessionView, SessionViewTabs } from "./SessionViewTabs";

export type SessionDetailsProps = {
  sessionId: string;
};

const DEFAULT_SESSION_VIEW: SessionView = "turns";

const setSessionViewSearchParam = ({
  params,
  view,
}: {
  params: URLSearchParams;
  view: SessionView;
}) => {
  const nextParams = new URLSearchParams(params);
  nextParams.set(SESSION_VIEW_PARAM, view);
  return nextParams;
};

/**
 * A component that shows the details of a session
 */
export function SessionDetails(props: SessionDetailsProps) {
  const { sessionId } = props;
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionViewParam = searchParams.get(SESSION_VIEW_PARAM);
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

  const loadQueryForSessionView = useCallback(
    (view: SessionView) => {
      // The annotations view fetches its own data when it mounts.
      if (view === "annotations") {
        return;
      }
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
    },
    [sessionId, loadTracesViewQuery, loadTraceListQuery]
  );

  useEffect(() => {
    if (isSessionView(sessionViewParam)) {
      return;
    }
    setSearchParams(
      (params) => {
        return setSessionViewSearchParam({
          params,
          view: DEFAULT_SESSION_VIEW,
        });
      },
      { replace: true }
    );
  }, [sessionViewParam, setSearchParams]);

  // Keep the currently visible session view routable. We preload the target
  // query before swapping tabs so the current view stays mounted while the
  // next one fetches, avoiding a blank state during the transition.
  useEffect(() => {
    loadQueryForSessionView(sessionView);
  }, [sessionView, loadQueryForSessionView]);

  const handleSessionViewChange = (view: SessionView) => {
    if (view === sessionView) {
      return;
    }
    startViewTransition(() => {
      loadQueryForSessionView(view);
    });
    setSearchParams(
      (params) =>
        setSessionViewSearchParam({
          params,
          view,
        }),
      { replace: true }
    );
  };

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
      <Suspense fallback={null}>
        <SessionDetailPanelAnnotationBar sessionNodeId={sessionId} />
      </Suspense>
      <Flex
        direction="column"
        flex="1 1 auto"
        minHeight={0}
        css={css`
          overflow: hidden;
        `}
      >
        <SessionViewTabs
          sessionView={sessionView}
          onSessionViewChange={handleSessionViewChange}
          traceCount={traceCount}
        >
          <Suspense fallback={<Loading />}>
            {sessionView === "annotations" ? (
              <SessionAnnotationsTable sessionId={sessionId} />
            ) : sessionView === "traces" ? (
              tracesViewQueryRef != null && (
                <SessionDetailsTracesView queryRef={tracesViewQueryRef} />
              )
            ) : (
              traceListQueryRef != null && (
                <SessionDetailsTraceList queryRef={traceListQueryRef} />
              )
            )}
          </Suspense>
        </SessionViewTabs>
      </Flex>
    </main>
  );
}
