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
import { Button, Flex, Text } from "@phoenix/components";
import { ChatSessionUsage } from "@phoenix/components/agent/ChatSessionUsage";
import { Loading } from "@phoenix/components/core";
import { useNotifyError } from "@phoenix/contexts";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import type { AgentPosition } from "@phoenix/store/agentStore";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { AgentSessionsResource_sessions$key } from "./__generated__/AgentSessionsResource_sessions.graphql";
import type { AgentSessionsResourceDeleteMutation } from "./__generated__/AgentSessionsResourceDeleteMutation.graphql";
import type { AgentSessionsResourceQuery } from "./__generated__/AgentSessionsResourceQuery.graphql";
import type { AgentSessionsResourceSessionQuery } from "./__generated__/AgentSessionsResourceSessionQuery.graphql";
import { AgentChatHeader } from "./AgentChatPanelView";
import {
  AGENT_SESSIONS_CONNECTION_KEY,
  SESSION_PAGE_SIZE,
} from "./agentSessionRelay";
import { ChatView } from "./Chat";
import type { AgentSessionListItem } from "./SessionListMenu";
import {
  EMPTY_SESSION_DISPLAY_NAME,
  getSessionDisplayName,
} from "./sessionTitleUtils";
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
        agentSessions(first: $first, after: $after)
          @connection(key: "AgentSessionsResource_agentSessions") {
          edges {
            node {
              id
              title
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
  const relayEnvironment = useRelayEnvironment();
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const sessions = useAgentContext((state) => state.sessions);
  const sessionMap = useAgentContext((state) => state.sessionMap);
  const chatStatusBySessionId = useAgentContext(
    (state) => state.chatStatusBySessionId
  );
  const setActiveSession = useAgentContext((state) => state.setActiveSession);
  const createLocalSession = useAgentContext((state) => state.createSession);
  const deleteLocalSession = useAgentContext((state) => state.deleteSession);
  const notifyError = useNotifyError();
  const connectionId = ConnectionHandler.getConnectionID(
    "client:root",
    AGENT_SESSIONS_CONNECTION_KEY
  );

  const createSession = useCallback(
    (options?: { isTemporary?: boolean }) => {
      const state = store.getState();
      for (const sessionId of state.sessions) {
        const session = store.getState().sessionMap[sessionId];
        const status = store.getState().chatStatusBySessionId[sessionId];
        if (
          session?.id == null &&
          status !== "submitted" &&
          status !== "streaming"
        ) {
          store.getState().deleteSession(sessionId);
        }
      }
      return createLocalSession(options);
    },
    [createLocalSession, store]
  );

  const runtimeSessionById = useMemo(
    () =>
      new Map(
        Object.values(sessionMap).flatMap((session) =>
          session.id ? ([[session.id, session]] as const) : []
        )
      ),
    [sessionMap]
  );
  const serverSessions = data.agentSessions.edges.map(({ node }) => {
    const runtimeSession = runtimeSessionById.get(node.id);
    const clientKey = runtimeSession?.clientKey ?? node.id;
    return {
      clientKey,
      id: node.id,
      title: runtimeSession?.title || node.title,
      messages: runtimeSession?.messages ?? [],
      createdAt: Date.parse(node.createdAt as string),
      isTemporary: runtimeSession?.isTemporary ?? false,
      isDeleteDisabled:
        chatStatusBySessionId[clientKey] === "submitted" ||
        chatStatusBySessionId[clientKey] === "streaming",
    } satisfies AgentSessionListItem;
  });
  const serverSessionClientKeys = new Set(
    serverSessions.map((session) => session.clientKey)
  );
  const localSessions: AgentSessionListItem[] = [...sessions]
    .reverse()
    .flatMap((sessionId) => {
      const session = sessionMap[sessionId];
      if (!session || serverSessionClientKeys.has(session.clientKey)) {
        return [];
      }
      return [
        {
          clientKey: session.clientKey,
          id: session.id,
          title: session.title,
          messages: session.messages,
          createdAt: session.createdAt,
          isTemporary: session.isTemporary,
          isDeleteDisabled:
            chatStatusBySessionId[session.clientKey] === "submitted" ||
            chatStatusBySessionId[session.clientKey] === "streaming",
        },
      ];
    });
  const orderedSessions = [...localSessions, ...serverSessions];
  const orderedSessionsRef = useRef(orderedSessions);
  orderedSessionsRef.current = orderedSessions;

  useEffect(() => {
    if (activeSessionId !== null || store.getState().activeSessionId !== null) {
      return;
    }
    const mostRecentSession = orderedSessionsRef.current[0];
    if (mostRecentSession) {
      setActiveSession(mostRecentSession.clientKey);
    } else {
      createSession();
    }
  }, [activeSessionId, createSession, setActiveSession, store]);

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
      const session = orderedSessionsRef.current.find(
        (candidate) => candidate.clientKey === sessionId
      );
      const nextSession = orderedSessionsRef.current.find(
        (candidate) => candidate.clientKey !== sessionId
      );
      const isDeletingActiveSession = activeSessionId === sessionId;
      let replacementSessionId: string | null = null;
      if (isDeletingActiveSession) {
        if (nextSession) {
          setActiveSession(nextSession.clientKey);
        } else if (session?.id) {
          replacementSessionId = createSession();
        }
      }
      if (!session?.id) {
        deleteLocalSession(sessionId);
        if (isDeletingActiveSession && !nextSession) {
          createSession();
        }
        return;
      }
      commitDelete({
        variables: { id: session.id, connectionId },
        optimisticResponse: {
          deleteAgentSession: {
            deletedAgentSessionId: session.id,
          },
        },
        onCompleted: () => {
          deleteLocalSession(sessionId);
        },
        onError: (error) => {
          if (isDeletingActiveSession) {
            if (replacementSessionId) {
              deleteLocalSession(replacementSessionId);
            }
            setActiveSession(sessionId);
          }
          const messages = getErrorMessagesFromRelayMutationError(error);
          notifyError({
            title: "Session could not be deleted",
            message: messages?.[0] ?? error.message,
          });
        },
      });
    },
    [
      activeSessionId,
      commitDelete,
      connectionId,
      createSession,
      deleteLocalSession,
      notifyError,
      setActiveSession,
    ]
  );

  const activeSession = orderedSessions.find(
    (session) => session.clientKey === activeSessionId
  );
  const activeRuntimeSession = activeSessionId
    ? sessionMap[activeSessionId]
    : undefined;
  const sessionDisplayName = activeSession
    ? getSessionDisplayName(activeSession)
    : activeRuntimeSession
      ? getSessionDisplayName(activeRuntimeSession)
      : EMPTY_SESSION_DISPLAY_NAME;
  const panelState = useAgentChatPanelState();
  const handleMissingSession = useCallback(
    (sessionId: string) => {
      const missingSession = orderedSessionsRef.current.find(
        (session) => session.clientKey === sessionId
      );
      const nextSession = orderedSessionsRef.current.find(
        (session) => session.clientKey !== sessionId
      );
      const missingSessionId = missingSession?.id;
      if (missingSessionId) {
        commitLocalUpdate(relayEnvironment, (relayStore) => {
          const connection = ConnectionHandler.getConnection(
            relayStore.getRoot(),
            AGENT_SESSIONS_CONNECTION_KEY
          );
          if (connection) {
            ConnectionHandler.deleteNode(connection, missingSessionId);
          }
        });
      }
      if (nextSession) {
        setActiveSession(nextSession.clientKey);
      } else {
        createSession();
      }
    },
    [createSession, relayEnvironment, setActiveSession]
  );

  return (
    <>
      <AgentChatHeader
        sessionDisplayName={sessionDisplayName}
        orderedSessions={orderedSessions}
        activeSessionId={activeSessionId}
        isActiveSessionTemporary={activeRuntimeSession?.isTemporary}
        position={position}
        isPositionChangeDisabled={isPositionChangeDisabled}
        onSelectSession={setActiveSession}
        onDeleteSession={deleteSession}
        onCreateSession={createSession}
        onCreateTemporarySession={() => createSession({ isTemporary: true })}
        hasNextSessionPage={hasNext}
        isLoadingNextSessionPage={isLoadingNext}
        onLoadNextSessionPage={() => loadNext(SESSION_PAGE_SIZE)}
        onPositionChange={panelState.setPosition}
        onClose={panelState.closePanel}
      />
      {activeSessionId ? (
        activeRuntimeSession ? (
          <AgentChatController
            key={activeSessionId}
            sessionId={activeSessionId}
            initialMessages={activeRuntimeSession.messages}
          />
        ) : (
          <Suspense fallback={<Loading />}>
            <AgentSessionTranscript
              key={activeSessionId}
              sessionId={activeSessionId}
              onMissing={handleMissingSession}
            />
          </Suspense>
        )
      ) : (
        <Loading />
      )}
    </>
  );
}

function AgentSessionTranscript({
  sessionId,
  onMissing,
}: {
  sessionId: string;
  onMissing: (sessionId: string) => void;
}) {
  const data = useLazyLoadQuery<AgentSessionsResourceSessionQuery>(
    graphql`
      query AgentSessionsResourceSessionQuery($id: ID!) {
        agentSession: node(id: $id) {
          __typename
          ... on AgentSession {
            id
            title
            createdAt
            messages
          }
        }
      }
    `,
    { id: sessionId },
    { fetchPolicy: "store-or-network" }
  );
  const store = useAgentStore();
  const defaultModelConfig = useAgentContext(
    (state) => state.defaultModelConfig
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
      return;
    }
    store.getState().cacheSession({
      clientKey: sessionId,
      id: agentSession.id,
      title: agentSession.title,
      isTemporary: false,
      messages,
      context: [],
      modelConfig: { ...defaultModelConfig },
      createdAt: Date.parse(agentSession.createdAt as string),
    });
  }, [agentSession, defaultModelConfig, messages, onMissing, sessionId, store]);

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
  const { chatApiUrl, modelSelection, menuValue, handleModelChange } =
    useAgentChatPanelState();
  const {
    messages,
    sendMessage,
    stop,
    status,
    error,
    pendingElicitation,
    handleElicitationSubmit,
    handleElicitationCancel,
    retryMessage,
    rewindToMessage,
    forkFromMessage,
  } = useAgentChat({
    sessionId,
    chatApiUrl,
    modelSelection,
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
      retryMessage={retryMessage}
      rewindToMessage={rewindToMessage}
      forkFromMessage={forkFromMessage}
      modelMenuValue={menuValue}
      onModelChange={handleModelChange}
      autoFocusInput
    >
      <ChatSessionUsage sessionId={sessionId} />
    </ChatView>
  );
}
