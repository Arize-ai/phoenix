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
import { useAgentChatRuntimeVersion } from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import type { AgentPosition } from "@phoenix/store/agentStore";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { AgentSessionsResource_sessions$key } from "./__generated__/AgentSessionsResource_sessions.graphql";
import type { AgentSessionsResourceDeleteMutation } from "./__generated__/AgentSessionsResourceDeleteMutation.graphql";
import type { AgentSessionsResourceQuery } from "./__generated__/AgentSessionsResourceQuery.graphql";
import type { AgentSessionsResourceSessionQuery } from "./__generated__/AgentSessionsResourceSessionQuery.graphql";
import { AgentChatHeader } from "./AgentChatPanelView";
import {
  isSessionDeleteDisabled,
  useAgentSessionLifecycle,
} from "./AgentSessionLifecycleProvider";
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
  const runtime = useAgentChatRuntimeVersion();
  const relayEnvironment = useRelayEnvironment();
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const draftSessionId = useAgentContext((state) => state.draftSessionId);
  const sessionOperationById = useAgentContext(
    (state) => state.sessionOperationById
  );
  const setActiveSession = useAgentContext((state) => state.setActiveSession);
  const createLocalSession = useAgentContext((state) => state.createSession);
  const deleteLocalSession = useAgentContext((state) => state.deleteSession);
  const notifyError = useNotifyError();
  const lifecycle = useAgentSessionLifecycle();
  const connectionId = ConnectionHandler.getConnectionID(
    "client:root",
    AGENT_SESSIONS_CONNECTION_KEY
  );

  const createSession = useCallback(() => {
    return createLocalSession();
  }, [createLocalSession]);
  const serverSessions: AgentSessionListItem[] = data.agentSessions.edges.map(
    ({ node }) => {
      const status = runtime.getStatus(node.id);
      return {
        id: node.id,
        title: node.title,
        createdAt: Date.parse(node.createdAt as string),
        isDeleteDisabled: isSessionDeleteDisabled({
          status,
          operation: sessionOperationById[node.id],
          hasUnresolvedToolCalls: runtime.hasUnresolvedToolCalls(node.id),
        }),
      } satisfies AgentSessionListItem;
    }
  );
  const localSessions: AgentSessionListItem[] = draftSessionId
    ? [
        {
          id: draftSessionId,
          isDraft: true,
          title: "",
          createdAt: Date.now(),
          isDeleteDisabled: isSessionDeleteDisabled({
            status: "ready",
            operation: sessionOperationById[draftSessionId],
          }),
        },
      ]
    : [];
  const orderedSessions: AgentSessionListItem[] = [
    ...localSessions,
    ...serverSessions,
  ];
  const orderedSessionsRef = useRef(orderedSessions);
  orderedSessionsRef.current = orderedSessions;

  useEffect(() => {
    if (activeSessionId !== null || store.getState().activeSessionId !== null) {
      return;
    }
    const mostRecentSession = orderedSessionsRef.current[0];
    if (mostRecentSession) {
      setActiveSession(mostRecentSession.id);
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
        (candidate) => candidate.id === sessionId
      );
      const liveStatus = runtime.getStatus(sessionId);
      const liveOperation = store.getState().sessionOperationById[sessionId];
      if (
        isSessionDeleteDisabled({
          status: liveStatus,
          operation: liveOperation,
          hasUnresolvedToolCalls: runtime.hasUnresolvedToolCalls(sessionId),
        })
      ) {
        return;
      }
      const nextSession = orderedSessionsRef.current.find(
        (candidate) => candidate.id !== sessionId
      );
      const isDeletingActiveSession = activeSessionId === sessionId;
      let replacementSessionId: string | null = null;
      if (isDeletingActiveSession) {
        if (nextSession) {
          setActiveSession(nextSession.id);
        } else if (session && !session.isDraft) {
          replacementSessionId = createSession();
        }
      }
      if (!session || session.isDraft) {
        lifecycle.cancelDraftCreation(sessionId);
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
      lifecycle,
      runtime,
      setActiveSession,
      store,
    ]
  );

  const activeSession = orderedSessions.find(
    (session) => session.id === activeSessionId
  );
  const sessionDisplayName = activeSession
    ? getSessionDisplayName(activeSession)
    : EMPTY_SESSION_DISPLAY_NAME;
  const panelState = useAgentChatPanelState();
  const handleMissingSession = useCallback(
    (sessionId: string) => {
      const missingSession = orderedSessionsRef.current.find(
        (session) => session.id === sessionId
      );
      const nextSession = orderedSessionsRef.current.find(
        (session) => session.id !== sessionId
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
        setActiveSession(nextSession.id);
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
        position={position}
        isPositionChangeDisabled={isPositionChangeDisabled}
        onSelectSession={setActiveSession}
        onDeleteSession={deleteSession}
        onCreateSession={createSession}
        hasNextSessionPage={hasNext}
        isLoadingNextSessionPage={isLoadingNext}
        onLoadNextSessionPage={() => loadNext(SESSION_PAGE_SIZE)}
        onPositionChange={panelState.setPosition}
        onClose={panelState.closePanel}
      />
      {activeSessionId ? (
        activeSession?.isDraft ? (
          <AgentDraftController
            key={activeSessionId}
            draftSessionId={activeSessionId}
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

function AgentDraftController({ draftSessionId }: { draftSessionId: string }) {
  const lifecycle = useAgentSessionLifecycle();
  const operation = useAgentContext(
    (state) => state.sessionOperationById[draftSessionId]
  );
  const error = useAgentContext(
    (state) => state.sessionLifecycleErrorById[draftSessionId]
  );
  const { menuValue, handleModelChange } =
    useAgentChatPanelState(draftSessionId);

  const sendMessage = useCallback(
    (
      message: { text: string },
      options?: { body?: Record<string, unknown> }
    ) => {
      if (operation) {
        return;
      }
      const requestedSkills = options?.body?.requestedSkills;
      lifecycle.stageMessage(draftSessionId, {
        text: message.text,
        requestedSkills: Array.isArray(requestedSkills)
          ? requestedSkills.filter(
              (skill): skill is string => typeof skill === "string"
            )
          : [],
      });
    },
    [draftSessionId, lifecycle, operation]
  );
  const status =
    operation === "creating" ? "submitted" : error ? "error" : "ready";

  return (
    <ChatView
      sessionId={draftSessionId}
      messages={[]}
      sendMessage={sendMessage}
      stop={async () => lifecycle.cancelDraftCreation(draftSessionId)}
      status={status}
      error={error}
      pendingElicitation={null}
      handleElicitationSubmit={() => undefined}
      handleElicitationCancel={() => undefined}
      modelMenuValue={menuValue}
      onModelChange={handleModelChange}
      autoFocusInput
    />
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
            updatedAt
            messages
          }
        }
      }
    `,
    { id: sessionId },
    { fetchPolicy: "store-or-network" }
  );
  const store = useAgentStore();
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
    store.getState().cacheSession(agentSession.id);
  }, [agentSession, onMissing, sessionId, store]);

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
  initialMessages?: AgentUIMessage[];
}) {
  const { chatApiUrl, modelSelection, menuValue, handleModelChange } =
    useAgentChatPanelState(sessionId);
  const {
    messages,
    sendMessage,
    stop,
    status,
    error,
    syncError,
    pendingElicitation,
    handleElicitationSubmit,
    handleElicitationCancel,
    retryMessage,
    rewindToMessage,
    forkFromMessage,
    isSessionOperationPending,
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
      syncError={syncError}
      pendingElicitation={pendingElicitation}
      handleElicitationSubmit={handleElicitationSubmit}
      handleElicitationCancel={handleElicitationCancel}
      retryMessage={retryMessage}
      rewindToMessage={rewindToMessage}
      forkFromMessage={forkFromMessage}
      isSessionOperationPending={isSessionOperationPending}
      modelMenuValue={menuValue}
      onModelChange={handleModelChange}
      autoFocusInput
    >
      <ChatSessionUsage sessionId={sessionId} messages={messages} />
    </ChatView>
  );
}
