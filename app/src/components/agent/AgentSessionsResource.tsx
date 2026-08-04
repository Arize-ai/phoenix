import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  ConnectionHandler,
  commitLocalUpdate,
  fetchQuery,
  graphql,
  useLazyLoadQuery,
  useMutation,
  usePaginationFragment,
  useRelayEnvironment,
} from "react-relay";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { Alert, Button, Flex, Text } from "@phoenix/components";
import { ChatSessionUsage } from "@phoenix/components/agent/ChatSessionUsage";
import { Loading } from "@phoenix/components/core";
import { useAgentChatRuntime } from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import type { AgentPosition } from "@phoenix/store/agentStore";
import { DRAFT_SESSION_ID } from "@phoenix/store/agentStore";
import type { ModelConfig } from "@phoenix/store/playground/types";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { agentSessionModelSessionQuery } from "./__generated__/agentSessionModelSessionQuery.graphql";
import type { agentSessionRelaySessionQuery } from "./__generated__/agentSessionRelaySessionQuery.graphql";
import type { AgentSessionsResource_sessions$key } from "./__generated__/AgentSessionsResource_sessions.graphql";
import type { AgentSessionsResourceDeleteMutation } from "./__generated__/AgentSessionsResourceDeleteMutation.graphql";
import type { AgentSessionsResourceQuery } from "./__generated__/AgentSessionsResourceQuery.graphql";
import { AgentChatHeader } from "./AgentChatPanelView";
import {
  sessionModelQuery,
  useAgentSessionModelConfig,
} from "./agentSessionModel";
import {
  AGENT_SESSIONS_CONNECTION_KEY,
  SESSION_PAGE_SIZE,
  agentSessionQuery,
} from "./agentSessionRelay";
import { ChatView } from "./Chat";
import type { AgentSessionListItem } from "./SessionListMenu";
import { EMPTY_SESSION_DISPLAY_NAME } from "./sessionTitleUtils";
import { useAgentChat } from "./useAgentChat";
import { useAgentChatPanelState } from "./useAgentChatPanelState";

const sessionsQuery = graphql`
  query AgentSessionsResourceQuery($first: Int!) {
    ...AgentSessionsResource_sessions @arguments(first: $first)
  }
`;

type AgentSessionsResourceProps = {
  position?: AgentPosition;
  isPositionChangeDisabled?: boolean;
};

export function AgentSessionsResource(props: AgentSessionsResourceProps) {
  const [fetchKey, setFetchKey] = useState(0);
  return (
    <ErrorBoundary
      onReset={() => setFetchKey((current) => current + 1)}
      fallbackRender={({ error, resetErrorBoundary }) => (
        <Flex
          direction="column"
          alignItems="center"
          justifyContent="center"
          gap="size-100"
          height="100%"
        >
          <Text>
            {error instanceof Error
              ? error.message
              : "Session history could not be loaded."}
          </Text>
          <Button size="S" onPress={resetErrorBoundary}>
            Retry
          </Button>
        </Flex>
      )}
    >
      <Suspense fallback={<Loading />}>
        <AgentSessionsLoader {...props} fetchKey={fetchKey} />
      </Suspense>
    </ErrorBoundary>
  );
}

function AgentSessionsLoader({
  fetchKey,
  ...props
}: AgentSessionsResourceProps & { fetchKey: number }) {
  const query = useLazyLoadQuery<AgentSessionsResourceQuery>(
    sessionsQuery,
    { first: SESSION_PAGE_SIZE },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  return <AgentSessionsContent {...props} query={query} />;
}

function AgentSessionsContent({
  query,
  position,
  isPositionChangeDisabled = false,
}: AgentSessionsResourceProps & {
  query: AgentSessionsResource_sessions$key;
}) {
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    AgentSessionsResourceQuery,
    AgentSessionsResource_sessions$key
  >(
    graphql`
      fragment AgentSessionsResource_sessions on Query
      @refetchable(queryName: "AgentSessionsResourcePaginationQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 20 }
      ) {
        agentSessions(first: $first, after: $after, viewerOnly: true)
          @connection(key: "AgentSessionsResource_agentSessions", filters: []) {
          edges {
            node {
              id
              title
              ...EditAgentSessionTitleDialog_session
              isTemporary: isEphemeral
              isActive
              createdAt
              updatedAt
            }
          }
        }
      }
    `,
    query
  );
  const store = useAgentStore();
  const runtime = useAgentChatRuntime();
  const relayEnvironment = useRelayEnvironment();
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const chatStatusBySessionId = useAgentContext(
    (state) => state.chatStatusBySessionId
  );
  const isBusyElsewhereBySessionId = useAgentContext(
    (state) => state.isBusyElsewhereBySessionId
  );
  const setActiveSession = useAgentContext((state) => state.setActiveSession);
  const clearSessionEphemeralState = useAgentContext(
    (state) => state.clearSessionEphemeralState
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const connectionId = ConnectionHandler.getConnectionID(
    "client:root",
    AGENT_SESSIONS_CONNECTION_KEY
  );

  /**
   * Switches the panel to the not-yet-persisted draft surface. The server
   * session is created imperatively when the user sends the draft's first
   * message, so no empty session rows are ever written.
   */
  const startNewSession = useCallback(() => {
    setDeleteError(null);
    const state = store.getState();
    state.setIsDraftSessionTemporary(state.defaultTemporaryChat);
    setActiveSession(DRAFT_SESSION_ID);
  }, [setActiveSession, store]);

  // The active draft is deliberately absent from the menu: it has no server
  // row yet, so listing it would only offer a "New chat" entry that cannot be
  // deleted or meaningfully switched to. The header still labels the active
  // draft via the display-name fallback below.
  const serverSessions: AgentSessionListItem[] = useMemo(
    () =>
      data.agentSessions.edges.map(({ node }) => ({
        id: node.id,
        title: node.title,
        isTemporary: node.isTemporary,
        createdAt: Date.parse(node.createdAt as string),
        isDeleteDisabled:
          node.isActive ||
          isBusyElsewhereBySessionId[node.id] === true ||
          chatStatusBySessionId[node.id] === "submitted" ||
          chatStatusBySessionId[node.id] === "streaming",
      })),
    [
      chatStatusBySessionId,
      data.agentSessions.edges,
      isBusyElsewhereBySessionId,
    ]
  );

  // On first open with no selection, resume the most recent conversation, or
  // start a draft when the user has no sessions yet.
  const mostRecentServerSessionId = data.agentSessions.edges[0]?.node.id;
  useEffect(() => {
    if (activeSessionId !== null || store.getState().activeSessionId !== null) {
      return;
    }
    setActiveSession(mostRecentServerSessionId ?? DRAFT_SESSION_ID);
  }, [activeSessionId, mostRecentServerSessionId, setActiveSession, store]);

  const [commitDelete] =
    useMutation<AgentSessionsResourceDeleteMutation>(graphql`
      mutation AgentSessionsResourceDeleteMutation(
        $id: ID!
        $connectionId: ID!
      ) {
        deleteAgentSession(input: { id: $id }) {
          deletedAgentSessionId @deleteEdge(connections: [$connectionId])
        }
      }
    `);

  const deleteSession = useCallback(
    (sessionId: string) => {
      setDeleteError(null);
      if (sessionId === DRAFT_SESSION_ID) {
        // The draft has no server session; deleting it just resets its
        // ephemeral state (draft input, staged message).
        clearSessionEphemeralState(DRAFT_SESSION_ID);
        const state = store.getState();
        state.setIsDraftSessionTemporary(state.defaultTemporaryChat);
        return;
      }
      const isDeletingActiveSession = activeSessionId === sessionId;
      if (isDeletingActiveSession) {
        const nextSession = serverSessions.find(
          (candidate) => candidate.id !== sessionId
        );
        setActiveSession(nextSession?.id ?? DRAFT_SESSION_ID);
      }
      commitDelete({
        variables: { id: sessionId, connectionId },
        optimisticResponse: {
          deleteAgentSession: {
            deletedAgentSessionId: sessionId,
          },
        },
        onCompleted: () => {
          runtime.evictChat(sessionId);
          clearSessionEphemeralState(sessionId);
        },
        onError: (error) => {
          if (isDeletingActiveSession) {
            setActiveSession(sessionId);
          }
          const messages = getErrorMessagesFromRelayMutationError(error);
          setDeleteError(messages?.[0] ?? error.message);
        },
      });
    },
    [
      activeSessionId,
      clearSessionEphemeralState,
      commitDelete,
      connectionId,
      runtime,
      serverSessions,
      setActiveSession,
      store,
    ]
  );

  const activeSession = serverSessions.find(
    (session) => session.id === activeSessionId
  );
  const sessionDisplayName = activeSession?.title || EMPTY_SESSION_DISPLAY_NAME;
  const selectSession = useCallback(
    (sessionId: string | null) => {
      setDeleteError(null);
      setActiveSession(sessionId);
    },
    [setActiveSession]
  );
  const panelState = useAgentChatPanelState();

  // Refresh the session list in the background whenever the menu opens so
  // sessions created elsewhere (e.g. another tab) show up. The store keeps
  // rendering the cached list while the network response replaces the
  // connection's first page.
  const handleSessionMenuOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        return;
      }
      fetchQuery<AgentSessionsResourceQuery>(relayEnvironment, sessionsQuery, {
        first: SESSION_PAGE_SIZE,
      }).subscribe({
        // Ignore failures — the menu still shows the cached session list.
        error: () => {},
      });
    },
    [relayEnvironment]
  );

  const handleMissingSession = useCallback(
    (sessionId: string) => {
      commitLocalUpdate(relayEnvironment, (relayStore) => {
        const connection = ConnectionHandler.getConnection(
          relayStore.getRoot(),
          AGENT_SESSIONS_CONNECTION_KEY
        );
        if (connection) {
          ConnectionHandler.deleteNode(connection, sessionId);
        }
      });
      const nextSession = serverSessions.find(
        (session) => session.id !== sessionId
      );
      setActiveSession(nextSession?.id ?? DRAFT_SESSION_ID);
    },
    [relayEnvironment, serverSessions, setActiveSession]
  );

  // Decide once per session activation whether the surface must first seed
  // from the server transcript. The decision is deliberately frozen for the
  // activation's duration: the transcript view creates the runtime chat when
  // it mounts, and flipping to the resident branch on a later render would
  // remount the chat surface mid-conversation.
  const needsTranscriptSeed = useMemo(
    () =>
      activeSessionId != null &&
      activeSessionId !== DRAFT_SESSION_ID &&
      runtime.getChat(activeSessionId) == null,
    [activeSessionId, runtime]
  );

  return (
    <>
      <AgentChatHeader
        sessionDisplayName={sessionDisplayName}
        orderedSessions={serverSessions}
        activeSessionId={activeSessionId}
        activeSessionTitleFragment={
          activeSessionId == null
            ? null
            : data.agentSessions.edges.find(
                ({ node }) => node.id === activeSessionId
              )?.node
        }
        isActiveSessionTemporary={activeSession?.isTemporary}
        position={position}
        isPositionChangeDisabled={isPositionChangeDisabled}
        onSelectSession={selectSession}
        onDeleteSession={deleteSession}
        onCreateSession={startNewSession}
        hasNextSessionPage={hasNext}
        isLoadingNextSessionPage={isLoadingNext}
        onLoadNextSessionPage={() => loadNext(SESSION_PAGE_SIZE)}
        onSessionMenuOpenChange={handleSessionMenuOpenChange}
        onPositionChange={panelState.setPosition}
        onClose={panelState.closePanel}
      />
      {deleteError ? (
        <div role="alert">
          <Alert
            banner
            variant="danger"
            title="Session could not be deleted"
            dismissable
            onDismissClick={() => setDeleteError(null)}
          >
            {deleteError}
          </Alert>
        </div>
      ) : null}
      {activeSessionId == null ? (
        <Loading />
      ) : (
        <Suspense fallback={<Loading />}>
          {needsTranscriptSeed ? (
            <AgentSessionTranscript
              key={activeSessionId}
              sessionId={activeSessionId}
              onMissing={handleMissingSession}
            />
          ) : activeSessionId === DRAFT_SESSION_ID ? (
            <AgentChatController
              key={activeSessionId}
              sessionId={activeSessionId}
              initialMessages={[]}
              shouldSyncOnMount
            />
          ) : (
            <AgentSessionModelLoader
              key={activeSessionId}
              sessionId={activeSessionId}
            />
          )}
        </Suspense>
      )}
    </>
  );
}

/**
 * Loads a session's persisted transcript from the server to seed its runtime
 * chat. Only sessions without a resident runtime chat pass through here — once
 * the chat exists it owns the in-memory conversation until the session is
 * deleted.
 */
function AgentSessionTranscript({
  sessionId,
  onMissing,
}: {
  sessionId: string;
  onMissing: (sessionId: string) => void;
}) {
  const data = useLazyLoadQuery<agentSessionRelaySessionQuery>(
    agentSessionQuery,
    { id: sessionId },
    { fetchPolicy: "network-only" }
  );
  const agentSession =
    data.agentSession.__typename === "AgentSession" ? data.agentSession : null;
  const messages = useMemo(
    () =>
      Array.isArray(agentSession?.messages)
        ? (agentSession.messages as AgentUIMessage[])
        : [],
    [agentSession?.messages]
  );
  const sessionModelConfig = useAgentSessionModelConfig(agentSession);
  useEffect(() => {
    if (!agentSession) {
      onMissing(sessionId);
    }
  }, [agentSession, onMissing, sessionId]);

  if (!agentSession) {
    return <Loading />;
  }
  return (
    <AgentChatController
      sessionId={sessionId}
      initialMessages={messages}
      isActive={agentSession.isActive}
      shouldSyncOnMount={false}
      sessionModelConfig={sessionModelConfig}
    />
  );
}

/** Binds a session with an in-memory chat, loading only its model selection. */
function AgentSessionModelLoader({ sessionId }: { sessionId: string }) {
  const data = useLazyLoadQuery<agentSessionModelSessionQuery>(
    sessionModelQuery,
    { id: sessionId },
    { fetchPolicy: "store-or-network" }
  );
  const sessionModelKey =
    data.agentSession.__typename === "AgentSession" ? data.agentSession : null;
  const sessionModelConfig = useAgentSessionModelConfig(sessionModelKey);
  return (
    <AgentChatController
      sessionId={sessionId}
      initialMessages={[]}
      shouldSyncOnMount
      sessionModelConfig={sessionModelConfig}
    />
  );
}

function AgentChatController({
  sessionId,
  initialMessages,
  isActive,
  shouldSyncOnMount,
  sessionModelConfig,
}: {
  sessionId: string;
  initialMessages: AgentUIMessage[];
  /** Relay-derived: another client's turn holds the session's server lock. */
  isActive?: boolean;
  /** Whether this runtime skipped a fresh transcript query when it mounted. */
  shouldSyncOnMount: boolean;
  /**
   * The session's persisted model resolved from its Relay record; absent for
   * draft surfaces, which render the default model config instead.
   */
  sessionModelConfig?: ModelConfig;
}) {
  const {
    menuValue,
    handleModelChange,
    modelChangeError,
    clearModelChangeError,
  } = useAgentChatPanelState({ sessionId, sessionModelConfig });
  const {
    messages,
    sendMessage,
    stop,
    status,
    error,
    pendingElicitation,
    handleElicitationSubmit,
    handleElicitationCancel,
    compactSession,
    isCompacting,
    compactionStatus,
    operationError,
    clearOperationError,
    rewindToMessage,
    forkFromMessage,
  } = useAgentChat({
    sessionId,
    initialMessages,
    isActive,
    shouldSyncOnMount,
  });

  const clearBothOperationErrors = useCallback(() => {
    clearOperationError();
    clearModelChangeError();
  }, [clearModelChangeError, clearOperationError]);

  return (
    <ChatView
      key={sessionId}
      sessionId={sessionId}
      messages={messages}
      sendMessage={sendMessage}
      stop={stop}
      status={status}
      error={error}
      pendingElicitation={pendingElicitation}
      handleElicitationSubmit={handleElicitationSubmit}
      handleElicitationCancel={handleElicitationCancel}
      compactSession={compactSession}
      isCompacting={isCompacting}
      compactionStatus={compactionStatus}
      operationError={operationError ?? modelChangeError}
      clearOperationError={clearBothOperationErrors}
      rewindToMessage={rewindToMessage}
      forkFromMessage={forkFromMessage}
      modelMenuValue={menuValue}
      onModelChange={handleModelChange}
      autoFocusInput
    >
      <ChatSessionUsage messages={messages} />
    </ChatView>
  );
}
