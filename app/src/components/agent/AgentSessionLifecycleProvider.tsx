import type { ChatStatus } from "ai";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useState,
} from "react";
import { graphql, useMutation, useRelayEnvironment } from "react-relay";

import { useNotifyError } from "@phoenix/contexts";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import type {
  AgentStore,
  PendingAgentMessage,
  AgentSessionOperation,
} from "@phoenix/store/agentStore";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { AgentSessionLifecycleCreateMutation } from "./__generated__/AgentSessionLifecycleCreateMutation.graphql";
import type { AgentSessionLifecycleDeleteMutation } from "./__generated__/AgentSessionLifecycleDeleteMutation.graphql";
import { refetchAgentSessions } from "./agentSessionRelay";
import { useAgentChat } from "./useAgentChat";
import { useAgentChatPanelState } from "./useAgentChatPanelState";

type DraftCreationAttempt = {
  isCancelled: boolean;
};

type DraftSessionLifecycle = {
  stageMessage: (sessionId: string, message: PendingAgentMessage) => void;
  cancelDraftCreation: (sessionId: string) => void;
};

type CreateDraftSessionLifecycleOptions = {
  store: AgentStore;
  createPersistedSession: () => Promise<string>;
  deletePersistedSession: (sessionId: string) => Promise<void>;
  refetchSessions: () => Promise<unknown>;
  notifyCreateError: (error: Error) => void;
  notifyCleanupError: (error: Error) => void;
};

export function isSessionDeleteDisabled({
  status,
  operation,
  hasUnresolvedToolCalls = false,
}: {
  status: ChatStatus;
  operation?: AgentSessionOperation;
  hasUnresolvedToolCalls?: boolean;
}): boolean {
  return (
    status === "submitted" ||
    status === "streaming" ||
    operation !== undefined ||
    hasUnresolvedToolCalls
  );
}

/**
 * Owns draft creation independently of any mounted chat surface. A cancelled
 * request is allowed to finish so its server ID can be deleted safely.
 */
export function createDraftSessionLifecycle({
  store,
  createPersistedSession,
  deletePersistedSession,
  refetchSessions,
  notifyCreateError,
  notifyCleanupError,
}: CreateDraftSessionLifecycleOptions): DraftSessionLifecycle {
  const attempts = new Map<string, DraftCreationAttempt>();

  const stageMessage = (sessionId: string, message: PendingAgentMessage) => {
    const state = store.getState();
    if (state.draftSessionId !== sessionId) {
      state.setPendingMessage(sessionId, message);
      return;
    }
    if (attempts.has(sessionId)) {
      return;
    }

    const attempt: DraftCreationAttempt = { isCancelled: false };
    attempts.set(sessionId, attempt);
    state.setSessionLifecycleError(sessionId, null);
    state.setPendingMessage(sessionId, message);
    state.setSessionOperation(sessionId, "creating");

    void (async () => {
      try {
        const persistedSessionId = await createPersistedSession();
        const latestState = store.getState();
        const isCurrentAttempt = attempts.get(sessionId) === attempt;
        const isDraftStillLive =
          latestState.draftSessionId === sessionId &&
          latestState.sessionStateById[sessionId] !== undefined;

        if (attempt.isCancelled || !isCurrentAttempt || !isDraftStillLive) {
          if (isCurrentAttempt) {
            attempts.delete(sessionId);
          }
          try {
            await deletePersistedSession(persistedSessionId);
          } catch (error) {
            notifyCleanupError(normalizeError(error));
          }
          return;
        }

        attempts.delete(sessionId);
        latestState.setSessionOperation(sessionId, null);
        latestState.promoteSession(sessionId, persistedSessionId);
        void refetchSessions().catch((error) =>
          notifyCleanupError(normalizeError(error))
        );
      } catch (error) {
        if (attempts.get(sessionId) === attempt) {
          attempts.delete(sessionId);
        }
        if (attempt.isCancelled) {
          return;
        }
        const mutationError = normalizeError(error);
        const latestState = store.getState();
        latestState.setDraftInput(sessionId, message.text);
        latestState.setPendingMessage(sessionId, null);
        latestState.setSessionOperation(sessionId, null);
        latestState.setSessionLifecycleError(sessionId, mutationError);
        notifyCreateError(mutationError);
      }
    })();
  };

  return {
    stageMessage,
    cancelDraftCreation: (sessionId) => {
      const attempt = attempts.get(sessionId);
      if (attempt) {
        attempt.isCancelled = true;
        attempts.delete(sessionId);
      }
      const state = store.getState();
      state.setPendingMessage(sessionId, null);
      state.setSessionOperation(sessionId, null);
      state.setSessionLifecycleError(sessionId, null);
    },
  };
}

const AgentSessionLifecycleContext =
  createContext<DraftSessionLifecycle | null>(null);

export function AgentSessionLifecycleProvider({ children }: PropsWithChildren) {
  const store = useAgentStore();
  const relayEnvironment = useRelayEnvironment();
  const notifyError = useNotifyError();
  const pendingMessageSessionIds = useAgentContext((state) =>
    Object.keys(state.pendingMessageBySessionId).filter(
      (sessionId) => sessionId !== state.draftSessionId
    )
  );
  const [commitCreate] =
    useMutation<AgentSessionLifecycleCreateMutation>(graphql`
      mutation AgentSessionLifecycleCreateMutation {
        createAgentSession {
          agentSession {
            id
          }
        }
      }
    `);
  const [commitDelete] =
    useMutation<AgentSessionLifecycleDeleteMutation>(graphql`
      mutation AgentSessionLifecycleDeleteMutation($id: ID!) {
        deleteAgentSession(input: { id: $id }) {
          deletedAgentSessionId
        }
      }
    `);
  const [lifecycle] = useState<DraftSessionLifecycle>(() =>
    createDraftSessionLifecycle({
      store,
      createPersistedSession: () =>
        new Promise<string>((resolve, reject) => {
          commitCreate({
            variables: {},
            onCompleted: (response) =>
              resolve(response.createAgentSession.agentSession.id),
            onError: reject,
          });
        }),
      deletePersistedSession: (sessionId) =>
        new Promise<void>((resolve, reject) => {
          commitDelete({
            variables: { id: sessionId },
            onCompleted: () => resolve(),
            onError: reject,
          });
        }),
      refetchSessions: () =>
        refetchAgentSessions({ environment: relayEnvironment }),
      notifyCreateError: (error) => {
        const messages = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Session could not be created",
          message: messages?.[0] ?? error.message,
        });
      },
      notifyCleanupError: (error) => {
        const messages = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Cancelled session could not be deleted",
          message: messages?.[0] ?? error.message,
        });
      },
    })
  );

  return (
    <AgentSessionLifecycleContext.Provider value={lifecycle}>
      {children}
      {pendingMessageSessionIds.map((sessionId) => (
        <RootPendingAgentChat key={sessionId} sessionId={sessionId} />
      ))}
    </AgentSessionLifecycleContext.Provider>
  );
}

export function useAgentSessionLifecycle(): DraftSessionLifecycle {
  const lifecycle = useContext(AgentSessionLifecycleContext);
  if (!lifecycle) {
    throw new Error("Missing AgentSessionLifecycleProvider in the tree");
  }
  return lifecycle;
}

export function useOptionalAgentSessionLifecycle(): DraftSessionLifecycle | null {
  return useContext(AgentSessionLifecycleContext);
}

function RootPendingAgentChat({ sessionId }: { sessionId: string }) {
  const { chatApiUrl, modelSelection } = useAgentChatPanelState(sessionId);
  useAgentChat({
    sessionId,
    chatApiUrl,
    modelSelection,
    initialMessages: [],
  });
  return null;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Unknown mutation error");
}
