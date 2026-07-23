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
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
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

import type { SettingsAgentSessionActionMenuDeleteMutation } from "./__generated__/SettingsAgentSessionActionMenuDeleteMutation.graphql";

export function SettingsAgentSessionActionMenu({
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
    useMutation<SettingsAgentSessionActionMenuDeleteMutation>(graphql`
      mutation SettingsAgentSessionActionMenuDeleteMutation(
        $id: ID!
        $connectionIds: [ID!]!
      ) {
        deleteAgentSession(input: { id: $id }) {
          deletedAgentSessionId @deleteEdge(connections: $connectionIds)
        }
      }
    `);

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
      <MenuTrigger>
        <Button
          size="S"
          aria-label={`Actions for ${sessionTitle}`}
          leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
        />
        <Popover>
          <Menu
            disabledKeys={isDeleteDisabled ? ["delete"] : []}
            onAction={() => setIsDeleteDialogOpen(true)}
          >
            <MenuItem id="delete" textValue="Delete session">
              <Flex gap="size-75" alignItems="center">
                <Icon svg={<Icons.Trash />} />
                <Text>Delete</Text>
              </Flex>
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <DialogTrigger
        isOpen={isDeleteDialogOpen}
        onOpenChange={(isOpen) => {
          setIsDeleteDialogOpen(isOpen);
          if (isOpen) {
            setError(null);
          }
        }}
      >
        <ModalOverlay>
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
                  <Button
                    size="S"
                    variant="danger"
                    onPress={deleteSession}
                    isDisabled={isDeleting || isDeleteDisabled}
                  >
                    {isDeleting ? "Deleting..." : "Delete session"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </>
  );
}
