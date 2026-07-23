import { useState } from "react";
import { graphql, useFragment, useMutation } from "react-relay";

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
  Form,
  Input,
  Label,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { EditAgentSessionTitleDialog_session$key } from "./__generated__/EditAgentSessionTitleDialog_session.graphql";
import type { EditAgentSessionTitleDialogMutation } from "./__generated__/EditAgentSessionTitleDialogMutation.graphql";

export function EditAgentSessionTitleDialog({
  session,
  onClose,
}: {
  session: EditAgentSessionTitleDialog_session$key;
  onClose: () => void;
}) {
  const data = useFragment(
    graphql`
      fragment EditAgentSessionTitleDialog_session on AgentSession {
        id
        title
      }
    `,
    session
  );
  const [title, setTitle] = useState(data.title);
  const [error, setError] = useState<string | null>(null);
  const [commitUpdate, isUpdating] =
    useMutation<EditAgentSessionTitleDialogMutation>(graphql`
      mutation EditAgentSessionTitleDialogMutation(
        $input: UpdateAgentSessionTitleInput!
      ) {
        updateAgentSessionTitle(input: $input) {
          agentSession {
            ...EditAgentSessionTitleDialog_session
          }
          query {
            ...SettingsAgentSessionsCard_sessions @arguments(first: 20)
          }
        }
      }
    `);
  const trimmedTitle = title.trim();
  const isSaveDisabled =
    isUpdating || !trimmedTitle || trimmedTitle === data.title;

  const updateTitle = () => {
    if (isSaveDisabled) {
      return;
    }
    setError(null);
    commitUpdate({
      variables: {
        input: {
          id: data.id,
          title: trimmedTitle,
        },
      },
      onCompleted: onClose,
      onError: (mutationError) => {
        setError(
          getErrorMessagesFromRelayMutationError(mutationError)?.[0] ??
            "Failed to update assistant session title"
        );
      },
    });
  };

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit session title</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        {error ? (
          <View paddingX="size-200" paddingTop="size-100">
            <Alert variant="danger" banner>
              {error}
            </Alert>
          </View>
        ) : null}
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            updateTitle();
          }}
        >
          <View padding="size-200">
            <TextField
              value={title}
              onChange={setTitle}
              isDisabled={isUpdating}
              isInvalid={!trimmedTitle}
              autoFocus
            >
              <Label>Title</Label>
              <Input />
              <Text slot="description">The title cannot be empty.</Text>
            </TextField>
          </View>
          <DialogFooter>
            <Button
              size="S"
              variant="default"
              slot="close"
              isDisabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              size="S"
              variant={isSaveDisabled ? "default" : "primary"}
              type="submit"
              isDisabled={isSaveDisabled}
            >
              {isUpdating ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
