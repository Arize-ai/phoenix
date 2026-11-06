import type { Chat } from "@ai-sdk/react";
import { getToolName, isToolUIPart } from "ai";
import { useCallback } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import { buildAgentChatApiUrl } from "@phoenix/agent/chat/agentChatApi";
import { isRequestActive } from "@phoenix/agent/chat/chatUtils";
import {
  REWIND_CLEANUP_TOOL_NAMES,
  cleanupPendingToolState,
} from "@phoenix/agent/chat/pendingToolStateCleanup";
import { getRemovedUserMessageText } from "@phoenix/agent/chat/removedUserMessageText";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import type { PendingElicitation } from "@phoenix/agent/tools/elicit";
import { useAgentChatRuntime } from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { useAgentSessionHistoryBranchAgentSessionMutation } from "./__generated__/useAgentSessionHistoryBranchAgentSessionMutation.graphql";
import type { useAgentSessionHistoryTruncateAgentSessionMutation } from "./__generated__/useAgentSessionHistoryTruncateAgentSessionMutation.graphql";
import { AGENT_SESSIONS_CONNECTION_KEY } from "./agentSessionRelay";

const truncateAgentSessionMutation = graphql`
  mutation useAgentSessionHistoryTruncateAgentSessionMutation(
    $input: TruncateAgentSessionInput!
  ) {
    truncateAgentSession(input: $input) {
      agentSession {
        id
        title
        ...EditAgentSessionTitleDialog_session
        updatedAt
        firstInput
        latestOutput
        user {
          username
          profilePictureUrl
        }
        messages
      }
    }
  }
`;

const branchAgentSessionMutation = graphql`
  mutation useAgentSessionHistoryBranchAgentSessionMutation(
    $input: BranchAgentSessionInput!
    $connections: [ID!]!
  ) {
    branchAgentSession(input: $input) {
      agentSession
        @prependNode(
          connections: $connections
          edgeTypeName: "AgentSessionEdge"
        ) {
        id
        title
        ...EditAgentSessionTitleDialog_session
        isTemporary: isEphemeral
        createdAt
        updatedAt
        firstInput
        latestOutput
        user {
          username
          profilePictureUrl
        }
        messages
        ...agentSessionModel_session
      }
    }
  }
`;

/**
 * Transcript history operations for a persisted session: rewinding the
 * session in place (`truncateAgentSession`) and branching it into a new
 * session (`branchAgentSession`).
 */
export function useAgentSessionHistory({
  sessionId,
  isDraft,
  chatInstance,
  isBusyElsewhere,
  pendingElicitation,
  createChatForSession,
  setMessages,
  clearError,
}: {
  sessionId: string | null;
  isDraft: boolean;
  chatInstance: Chat<AgentUIMessage> | null;
  isBusyElsewhere: boolean;
  pendingElicitation: PendingElicitation | null;
  /** Builds the runtime chat for a branch's new session Relay ID. */
  createChatForSession: (
    sessionId: string,
    seedMessages: AgentUIMessage[]
  ) => Chat<AgentUIMessage>;
  setMessages: (messages: AgentUIMessage[]) => void;
  clearError: () => void;
}) {
  const store = useAgentStore();
  const runtime = useAgentChatRuntime();
  const [commitTruncateAgentSession] =
    useMutation<useAgentSessionHistoryTruncateAgentSessionMutation>(
      truncateAgentSessionMutation
    );
  const [commitBranchAgentSession] =
    useMutation<useAgentSessionHistoryBranchAgentSessionMutation>(
      branchAgentSessionMutation
    );
  const sessionsConnectionId = ConnectionHandler.getConnectionID(
    "client:root",
    AGENT_SESSIONS_CONNECTION_KEY
  );

  // Releases approval/elicitation state owned by tool calls dropped by a rewind
  // or branch, so stale Accept/Reject affordances don't dangle against tool calls
  // the transcript no longer contains.
  const clearDroppedToolState = useCallback(
    ({
      previous,
      next,
    }: {
      previous: AgentUIMessage[];
      next: AgentUIMessage[];
    }) => {
      if (!sessionId) {
        return;
      }
      const retained = new Set(
        next.flatMap((message) =>
          message.parts.filter(isToolUIPart).map((part) => part.toolCallId)
        )
      );
      const state = store.getState();
      for (const message of previous) {
        for (const part of message.parts) {
          if (!isToolUIPart(part) || retained.has(part.toolCallId)) {
            continue;
          }
          const toolName = getToolName(part);
          if (REWIND_CLEANUP_TOOL_NAMES.has(toolName)) {
            cleanupPendingToolState(state, toolName, part.toolCallId);
          } else if (pendingElicitation?.toolCallId === part.toolCallId) {
            state.setPendingElicitation(sessionId, null);
          }
        }
      }
    },
    [pendingElicitation, sessionId, store]
  );

  // Rewinds the active session in place at the chosen message. The truncation
  // itself runs server-side (`truncateAgentSession`); the runtime chat is then
  // reset to the persisted transcript and stale tool state is released.
  // Resolves to the user message text to restore into the input (user target)
  // or null (assistant target / no-op), and rejects when persistence fails.
  const rewindToMessage = useCallback(
    (messageId: string): Promise<string | null> => {
      if (
        isDraft ||
        !sessionId ||
        !chatInstance ||
        isBusyElsewhere ||
        isRequestActive(chatInstance.status)
      ) {
        return Promise.resolve(null);
      }
      // A rewind at a user message removes it; remember its text now so it
      // can be placed back into the prompt input once the truncation lands.
      const restoredInput = getRemovedUserMessageText(
        chatInstance.messages,
        messageId
      );
      return new Promise((resolve, reject) => {
        commitTruncateAgentSession({
          variables: { input: { id: sessionId, messageId } },
          onCompleted: (response) => {
            const payload = response.truncateAgentSession;
            const nextMessages = Array.isArray(payload.agentSession.messages)
              ? (payload.agentSession.messages as AgentUIMessage[])
              : [];
            clearDroppedToolState({
              previous: chatInstance.messages,
              next: nextMessages,
            });
            setMessages(nextMessages);
            clearError();
            resolve(restoredInput);
          },
          onError: (mutationError) => {
            const errorMessages =
              getErrorMessagesFromRelayMutationError(mutationError);
            reject(new Error(errorMessages?.[0] ?? mutationError.message));
          },
        });
      });
    },
    [
      chatInstance,
      clearDroppedToolState,
      clearError,
      commitTruncateAgentSession,
      isBusyElsewhere,
      isDraft,
      sessionId,
      setMessages,
    ]
  );

  // Branches the active session into a new server session truncated at the
  // chosen message, leaving the current session untouched. The server copies
  // the truncated transcript and derives the branch title; the UI seeds a
  // runtime chat from the returned transcript and activates it.
  const forkFromMessage = useCallback(
    (messageId: string): Promise<void> => {
      if (
        isDraft ||
        !sessionId ||
        !chatInstance ||
        isBusyElsewhere ||
        isRequestActive(chatInstance.status)
      ) {
        return Promise.resolve();
      }
      clearError();
      // Branching at a user message drops it from the branch; remember its
      // text now so the branch's composer starts with it.
      const restoredInput = getRemovedUserMessageText(
        chatInstance.messages,
        messageId
      );
      return new Promise((resolve, reject) => {
        commitBranchAgentSession({
          variables: {
            input: { id: sessionId, messageId },
            connections: [sessionsConnectionId],
          },
          onCompleted: (response) => {
            const payload = response.branchAgentSession;
            const branchSessionId = payload.agentSession.id;
            const branchChatApiUrl = buildAgentChatApiUrl(branchSessionId);
            const branchMessages = Array.isArray(payload.agentSession.messages)
              ? (payload.agentSession.messages as AgentUIMessage[])
              : [];
            runtime.getOrCreateChat({
              sessionId: branchSessionId,
              chatApiUrl: branchChatApiUrl,
              createChat: (previousMessages) =>
                createChatForSession(
                  branchSessionId,
                  previousMessages ?? branchMessages
                ),
            });
            const state = store.getState();
            if (restoredInput) {
              state.setDraftInput(branchSessionId, restoredInput);
            }
            state.setActiveSession(branchSessionId);
            resolve();
          },
          onError: (mutationError) => {
            const errorMessages =
              getErrorMessagesFromRelayMutationError(mutationError);
            reject(new Error(errorMessages?.[0] ?? mutationError.message));
          },
        });
      });
    },
    [
      chatInstance,
      clearError,
      commitBranchAgentSession,
      createChatForSession,
      isBusyElsewhere,
      isDraft,
      runtime,
      sessionId,
      sessionsConnectionId,
      store,
    ]
  );

  return { rewindToMessage, forkFromMessage };
}
