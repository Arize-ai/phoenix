import { css } from "@emotion/react";
import { useState } from "react";
import { ConnectionHandler, graphql, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import {
  AGENT_SESSIONS_CONNECTION_KEY,
  SETTINGS_AGENT_SESSIONS_CONNECTION_KEY,
} from "@phoenix/components/agent/agentSessionRelay";
import { useAgentChatRuntime } from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";
import { DRAFT_SESSION_ID } from "@phoenix/store/agentStore";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SettingsAgentSessionDeleteButtonMutation } from "./__generated__/SettingsAgentSessionDeleteButtonMutation.graphql";

const deleteBusyIndicatorCSS = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--global-button-height-s);
  height: var(--global-button-height-s);
  color: var(--global-text-color-700);
  font-size: var(--global-font-size-l);
`;

function DeleteBusyIndicator({ label }: { label: string }) {
  return (
    <span role="status" aria-label={label} css={deleteBusyIndicatorCSS}>
      <Icon svg={<Icons.Loading />} />
    </span>
  );
}

export function SettingsAgentSessionConditionalDeleteButton({
  sessionId,
  sessionTitle,
}: {
  sessionId: string;
  sessionTitle: string;
}) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const store = useAgentStore();
  const runtime = useAgentChatRuntime();
  const activeSessionId = useAgentContext((state) => state.activeSessionId);
  const chatStatus = useAgentContext(
    (state) => state.chatStatusBySessionId[sessionId]
  );
  const setActiveSession = useAgentContext((state) => state.setActiveSession);
  const clearSessionEphemeralState = useAgentContext(
    (state) => state.clearSessionEphemeralState
  );
  const isDeleteDisabled =
    chatStatus === "submitted" || chatStatus === "streaming";
  const connectionIds = [
    ConnectionHandler.getConnectionID(
      "client:root",
      SETTINGS_AGENT_SESSIONS_CONNECTION_KEY
    ),
    ConnectionHandler.getConnectionID(
      "client:root",
      AGENT_SESSIONS_CONNECTION_KEY
    ),
  ];
  const [commitDelete, isDeleting] =
    useMutation<SettingsAgentSessionDeleteButtonMutation>(graphql`
      mutation SettingsAgentSessionDeleteButtonMutation(
        $id: ID!
        $connectionIds: [ID!]!
      ) {
        deleteAgentSession(input: { id: $id }) {
          deletedAgentSessionId @deleteEdge(connections: $connectionIds)
        }
      }
    `);
  const isDeleteBusy = isDeleteDisabled || isDeleting;
  const deleteBusyLabel = isDeleting
    ? `Deleting ${sessionTitle}`
    : `${sessionTitle} is busy`;

  const deleteSession = () => {
    if (isDeleteDisabled) {
      return;
    }
    setError(null);
    const isDeletingActiveSession = activeSessionId === sessionId;
    if (isDeletingActiveSession) {
      const state = store.getState();
      state.setIsDraftSessionTemporary(state.defaultTemporaryChat);
      setActiveSession(DRAFT_SESSION_ID);
    }
    commitDelete({
      variables: { id: sessionId, connectionIds },
      onCompleted: () => {
        runtime.evictChat(sessionId);
        clearSessionEphemeralState(sessionId);
        setIsDeleteDialogOpen(false);
      },
      onError: (mutationError) => {
        if (isDeletingActiveSession) {
          setActiveSession(sessionId);
        }
        setError(
          getErrorMessagesFromRelayMutationError(mutationError)?.[0] ??
            "Failed to delete assistant session"
        );
      },
    });
  };

  return (
    <>
      {isDeleteBusy ? (
        <DeleteBusyIndicator label={deleteBusyLabel} />
      ) : (
        <Button
          size="S"
          variant="danger"
          aria-label={`Delete ${sessionTitle}`}
          leadingVisual={<Icon svg={<Icons.Trash />} />}
          onPress={() => setIsDeleteDialogOpen(true)}
        />
      )}
      <ModalOverlay
        isOpen={isDeleteDialogOpen}
        onOpenChange={(isOpen) => {
          setIsDeleteDialogOpen(isOpen);
          if (isOpen) {
            setError(null);
          }
        }}
      >
        <Modal size="S">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete assistant session</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                {error ? (
                  <Alert variant="danger" banner>
                    {error}
                  </Alert>
                ) : null}
                <Text>
                  This will permanently delete &quot;{sessionTitle}&quot; and
                  its messages. This action cannot be undone.
                </Text>
              </View>
              <DialogFooter>
                <Button
                  size="S"
                  variant="default"
                  slot="close"
                  isDisabled={isDeleting}
                >
                  Cancel
                </Button>
                {isDeleteBusy ? (
                  <DeleteBusyIndicator label={deleteBusyLabel} />
                ) : (
                  <Button
                    size="S"
                    variant="danger"
                    onPress={deleteSession}
                    leadingVisual={<Icon svg={<Icons.Trash />} />}
                  >
                    Delete session
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}
