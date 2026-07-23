import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  ConnectionHandler,
  commitLocalUpdate,
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
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { agentSessionRelaySessionQuery } from "./__generated__/agentSessionRelaySessionQuery.graphql";
import type { AgentSessionsResource_sessions$key } from "./__generated__/AgentSessionsResource_sessions.graphql";
import type { AgentSessionsResourceDeleteMutation } from "./__generated__/AgentSessionsResourceDeleteMutation.graphql";
import type { AgentSessionsResourceQuery } from "./__generated__/AgentSessionsResourceQuery.graphql";
import { AgentChatHeader } from "./AgentChatPanelView";
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
    ...SettingsAgentSessionsCard_sessions @arguments(first: $first)
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
        agentSessions(first: $first, after: $after)
          @connection(key: "AgentSessionsResource_agentSessions") {
          edges {
            node {
              id
              title
              isTemporary
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

  const serverSessions: AgentSessionListItem[] = data.agentSessions.edges.map(
    ({ node }) => ({
      id: node.id,
      title: node.title,
      isTemporary: node.isTemporary,
      createdAt: Date.parse(node.createdAt as string),
      isDeleteDisabled:
        chatStatusBySessionId[node.id] === "submitted" ||
        chatStatusBySessionId[node.id] === "streaming",
    })
  );
  const draftSession: AgentSessionListItem | null =
    activeSessionId === DRAFT_SESSION_ID
      ? {
          id: DRAFT_SESSION_ID,
          title: "",
          createdAt: Date.now(),
        }
      : null;
  const orderedSessions = draftSession
    ? [draftSession, ...serverSessions]
    : serverSessions;
  const orderedSessionsRef = useRef(orderedSessions);
  orderedSessionsRef.current = orderedSessions;

  // On first open with no selection, resume the most recent conversation, or
  // start a draft when the user has no sessions yet.
  useEffect(() => {
    if (activeSessionId !== null || store.getState().activeSessionId !== null) {
      return;
    }
    const mostRecentSession = orderedSessionsRef.current[0];
    setActiveSession(mostRecentSession?.id ?? DRAFT_SESSION_ID);
  }, [activeSessionId, setActiveSession, store]);

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
        const nextSession = orderedSessionsRef.current.find(
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
      setActiveSession,
      store,
    ]
  );

  const activeSession = orderedSessions.find(
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
      const nextSession = orderedSessionsRef.current.find(
        (session) => session.id !== sessionId
      );
      setActiveSession(nextSession?.id ?? DRAFT_SESSION_ID);
    },
    [relayEnvironment, setActiveSession]
  );

  // Decide once per session activation whether the surface must first seed
  // from the server transcript. The decision is deliberately frozen for the
  // activation's duration: the transcript view creates the runtime chat when
  // it mounts, and flipping to the direct branch on a later render would
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
        orderedSessions={orderedSessions}
        activeSessionId={activeSessionId}
        isActiveSessionTemporary={activeSession?.isTemporary}
        position={position}
        isPositionChangeDisabled={isPositionChangeDisabled}
        onSelectSession={selectSession}
        onDeleteSession={deleteSession}
        onCreateSession={startNewSession}
        hasNextSessionPage={hasNext}
        isLoadingNextSessionPage={isLoadingNext}
        onLoadNextSessionPage={() => loadNext(SESSION_PAGE_SIZE)}
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
      ) : needsTranscriptSeed ? (
        <Suspense fallback={<Loading />}>
          <AgentSessionTranscript
            key={activeSessionId}
            sessionId={activeSessionId}
            onMissing={handleMissingSession}
          />
        </Suspense>
      ) : (
        <AgentChatController
          key={activeSessionId}
          sessionId={activeSessionId}
          initialMessages={[]}
        />
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
  useEffect(() => {
    if (!agentSession) {
      onMissing(sessionId);
    }
  }, [agentSession, onMissing, sessionId]);

  if (!agentSession) {
    return <Loading />;
  }
  return (
    <AgentChatController sessionId={sessionId} initialMessages={messages} />
  );
}

function AgentChatController({
  sessionId,
  initialMessages,
}: {
  sessionId: string;
  initialMessages: AgentUIMessage[];
}) {
  const { menuValue, handleModelChange } = useAgentChatPanelState();
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
  });

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
      operationError={operationError}
      clearOperationError={clearOperationError}
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
