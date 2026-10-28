import { useState } from "react";
import { graphql, useMutation } from "react-relay";
import { useRevalidator } from "react-router";

import {
  Alert,
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Form,
  Label,
  Text,
  TextArea,
  TextField,
  View,
} from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { getInstancePromptParamsFromStore } from "@phoenix/pages/playground/playgroundPromptUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SavePromptVersionDialogMutation } from "./__generated__/SavePromptVersionDialogMutation.graphql";

/**
 * Saves the prompt being edited on the prompt page as its newest version
 */
export function SavePromptVersionDialog({
  promptId,
  instanceId,
  onSaved,
}: {
  promptId: string;
  instanceId: number;
  onSaved: () => void;
}) {
  const store = usePlaygroundStore();
  const notifySuccess = useNotifySuccess();
  const revalidator = useRevalidator();
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [commit, isCommitting] = useMutation<SavePromptVersionDialogMutation>(
    graphql`
      mutation SavePromptVersionDialogMutation(
        $input: CreateChatPromptVersionInput!
      ) {
        createChatPromptVersion(input: $input) {
          id
          name
          version {
            id
          }
        }
      }
    `
  );
  return (
    <Dialog>
      {({ close }) => (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Version</DialogTitle>
            <DialogTitleExtra>
              <DialogCloseButton />
            </DialogTitleExtra>
          </DialogHeader>
          {error ? (
            <Alert variant="danger" banner>
              {error}
            </Alert>
          ) : null}
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              const { promptInput } = getInstancePromptParamsFromStore(
                instanceId,
                store
              );
              commit({
                variables: {
                  input: {
                    promptId,
                    promptVersion: {
                      ...promptInput,
                      description: description || undefined,
                    },
                  },
                },
                onCompleted: (response) => {
                  const saved = response.createChatPromptVersion;
                  store.getState().updateInstance({
                    instanceId,
                    patch: {
                      prompt: {
                        id: saved.id,
                        name: saved.name,
                        version: saved.version.id,
                        tag: null,
                      },
                    },
                    dirty: false,
                  });
                  notifySuccess({ title: "Version saved" });
                  onSaved();
                  revalidator.revalidate();
                  close();
                },
                onError: (mutationError) => {
                  const messages =
                    getErrorMessagesFromRelayMutationError(mutationError);
                  setError(messages?.[0] ?? "Error saving the version");
                },
              });
            }}
          >
            <View padding="size-200">
              <TextField value={description} onChange={setDescription}>
                <Label>Description</Label>
                <TextArea placeholder="What changed in this version" />
                <Text slot="description">Optional</Text>
              </TextField>
            </View>
            <View
              paddingX="size-200"
              paddingY="size-100"
              borderTopColor="default"
              borderTopWidth="thin"
            >
              <Flex gap="size-100" justifyContent="end">
                <Button size="S" onPress={close} isDisabled={isCommitting}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="S"
                  type="submit"
                  isDisabled={isCommitting}
                >
                  Save Version
                </Button>
              </Flex>
            </View>
          </Form>
        </DialogContent>
      )}
    </Dialog>
  );
}
