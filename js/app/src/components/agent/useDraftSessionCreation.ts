import type { Chat } from "@ai-sdk/react";
import { useRef, useState } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import { buildAgentChatApiUrl } from "@phoenix/agent/chat/agentChatApi";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import { buildUserMessageMetadata } from "@phoenix/agent/chat/userMessageMetadata";
import { useAgentChatRuntime } from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { DRAFT_SESSION_ID } from "@phoenix/store/agentStore";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { useDraftSessionCreationCreateAgentSessionMutation } from "./__generated__/useDraftSessionCreationCreateAgentSessionMutation.graphql";
import {
  toAgentModelSelection,
  toAgentModelSelectionInput,
} from "./agentSessionModel";
import {
  AGENT_SESSIONS_CONNECTION_KEY,
  SETTINGS_AGENT_SESSIONS_CONNECTION_KEY,
} from "./agentSessionRelay";
import type { AgentChatOperationError } from "./types";

const createAgentSessionMutation = graphql`
  mutation useDraftSessionCreationCreateAgentSessionMutation(
    $input: CreateAgentSessionInput!
    $connections: [ID!]!
  ) {
    createAgentSession(input: $input) {
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
        ...agentSessionModel_session
      }
    }
  }
`;

type SendMessageArgs = Parameters<Chat<AgentUIMessage>["sendMessage"]>;

/**
 * Owns the draft surface's first-send lifecycle: sessions are created
 * imperatively on the server, so the first send runs the
 * `createAgentSession` mutation, seeds a runtime chat under the returned
 * Relay ID, sends the message through it, and activates the new session
 * (re-keying the visible surface).
 *
 * While the mutation round-trip is in flight, the first message is echoed
 * optimistically as `pendingDraftUserMessage` (rendered with a "submitted"
 * status, so the Thinking indicator shows).
 */
export function useDraftSessionCreation({
  createChatForSession,
  setOperationError,
}: {
  /** Builds the runtime chat for the newly created session's Relay ID. */
  createChatForSession: (
    sessionId: string,
    seedMessages: AgentUIMessage[]
  ) => Chat<AgentUIMessage>;
  setOperationError: (error: AgentChatOperationError | null) => void;
}) {
  const store = useAgentStore();
  const runtime = useAgentChatRuntime();
  const [commitCreateAgentSession] =
    useMutation<useDraftSessionCreationCreateAgentSessionMutation>(
      createAgentSessionMutation
    );
  const sessionsConnectionId = ConnectionHandler.getConnectionID(
    "client:root",
    AGENT_SESSIONS_CONNECTION_KEY
  );
  const settingsSessionsConnectionId = ConnectionHandler.getConnectionID(
    "client:root",
    SETTINGS_AGENT_SESSIONS_CONNECTION_KEY
  );
  // Guards the draft surface against double-submits while the create-session
  // mutation is in flight.
  const isCreatingSessionRef = useRef(false);
  const [pendingDraftUserMessage, setPendingDraftUserMessage] =
    useState<AgentUIMessage | null>(null);

  const createSessionAndSendMessage = (...args: SendMessageArgs) => {
    const [message, options] = args;
    const text =
      message != null && "text" in message && typeof message.text === "string"
        ? message.text.trim()
        : "";
    if (!text || isCreatingSessionRef.current) {
      return;
    }
    setOperationError(null);
    isCreatingSessionRef.current = true;
    setPendingDraftUserMessage({
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text }],
      metadata: buildUserMessageMetadata(),
    });
    // Pulse the collapsed-surface glyphs (widget, top nav) for the creation
    // wait too; clearSessionEphemeralState removes the flag on success.
    store.getState().setSessionResponsePending(DRAFT_SESSION_ID, true);
    const draftState = store.getState();
    const isTemporary = draftState.isDraftSessionTemporary;
    const modelSelection = toAgentModelSelection(draftState.defaultModelConfig);
    commitCreateAgentSession({
      variables: {
        input: {
          isEphemeral: isTemporary,
          model: toAgentModelSelectionInput(modelSelection),
        },
        connections: isTemporary
          ? [sessionsConnectionId]
          : [sessionsConnectionId, settingsSessionsConnectionId],
      },
      onCompleted: (response) => {
        isCreatingSessionRef.current = false;
        const newSessionId = response.createAgentSession.agentSession.id;
        const newChatApiUrl = buildAgentChatApiUrl(newSessionId);
        const newChat = runtime.getOrCreateChat({
          sessionId: newSessionId,
          chatApiUrl: newChatApiUrl,
          createChat: (previousMessages) =>
            createChatForSession(newSessionId, previousMessages ?? []),
        });
        void newChat.sendMessage(
          { text, metadata: buildUserMessageMetadata() },
          options
        );
        setPendingDraftUserMessage(null);
        const state = store.getState();
        state.clearSessionEphemeralState(DRAFT_SESSION_ID);
        state.setIsDraftSessionTemporary(state.defaultTemporaryChat);
        state.setActiveSession(newSessionId);
      },
      onError: (mutationError) => {
        isCreatingSessionRef.current = false;
        setPendingDraftUserMessage(null);
        store.getState().setSessionResponsePending(DRAFT_SESSION_ID, false);
        // Give the user their message back to retry.
        store.getState().setDraftInput(DRAFT_SESSION_ID, text);
        const errorMessages =
          getErrorMessagesFromRelayMutationError(mutationError);
        setOperationError({
          title: "Conversation could not be started",
          message: errorMessages?.[0] ?? mutationError.message,
        });
      },
    });
  };

  return {
    /**
     * The first message of a draft surface, echoed optimistically while the
     * create-session mutation round-trip is in flight. The real message is
     * sent through the new session's chat once the mutation returns.
     */
    pendingDraftUserMessage,
    createSessionAndSendMessage,
  };
}
