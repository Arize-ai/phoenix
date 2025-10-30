import { Suspense, useCallback } from "react";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";

import { Dialog, Loading } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { UpsertPromptFromTemplateDialogCreateMutation } from "@phoenix/pages/playground/__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";
import { UpsertPromptFromTemplateDialogUpdateMutation } from "@phoenix/pages/playground/__generated__/UpsertPromptFromTemplateDialogUpdateMutation.graphql";
import { getInstancePromptParamsFromStore } from "@phoenix/pages/playground/playgroundPromptUtils";
import {
  SavePromptForm,
  SavePromptFormParams,
} from "@phoenix/pages/playground/SavePromptForm";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

type UpsertPromptFromTemplateProps = {
  instanceId: number;
  selectedPromptId?: string;
};

export const UpsertPromptFromTemplateDialog = ({
  instanceId,
  selectedPromptId,
}: UpsertPromptFromTemplateProps) => {
  const navigate = useNavigate();
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const store = usePlaygroundStore();
  const [createPrompt, isCreatePending] =
    useMutation<UpsertPromptFromTemplateDialogCreateMutation>(graphql`
      mutation UpsertPromptFromTemplateDialogCreateMutation(
        $input: CreateChatPromptInput!
      ) {
        createChatPrompt(input: $input) {
          id
          name
          version {
            id
          }
        }
      }
    `);
  const [updatePrompt, isUpdatePending] =
    useMutation<UpsertPromptFromTemplateDialogUpdateMutation>(graphql`
      mutation UpsertPromptFromTemplateDialogUpdateMutation(
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
    `);
  // tasks to complete after either mutation completes successfully
  const onSuccess = useCallback(
    (promptId: string, promptName: string, promptVersion: string) => {
      const state = store.getState();
      const instance = state.instances.find(
        (instance) => instance.id === instanceId
      );
      if (!instance) {
        return;
      }
      state.updateInstance({
        instanceId,
        patch: {
          prompt: {
            id: promptId,
            name: promptName,
            version: promptVersion,
            // TODO: allow users to create tags at prompt creation time
            tag: null,
          },
        },
        dirty: false,
      });
    },
    [store, instanceId]
  );
  const onCreate = useCallback(
    (params: SavePromptFormParams, close: () => void) => {
      const { promptInput, templateFormat } = getInstancePromptParamsFromStore(
        instanceId,
        store
      );
      createPrompt({
        variables: {
          input: {
            name: params.name,
            description: params.description,
            promptVersion: {
              ...promptInput,
              templateFormat,
            },
          },
        },
        onCompleted: (response) => {
          notifySuccess({
            title: `Prompt successfully created`,
            action: {
              text: "View Prompt",
              onClick: () => {
                navigate(`/prompts/${response.createChatPrompt.id}`);
              },
            },
          });
          onSuccess(
            response.createChatPrompt.id,
            response.createChatPrompt.name,
            response.createChatPrompt.version.id
          );
          close();
        },
        onError: (error) => {
          const message = getErrorMessagesFromRelayMutationError(error);
          notifyError({
            title: "Error creating prompt",
            message: message?.[0],
          });
        },
      });
    },
    [
      createPrompt,
      instanceId,
      navigate,
      notifyError,
      notifySuccess,
      onSuccess,
      store,
    ]
  );
  const onUpdate = useCallback(
    (params: SavePromptFormParams, close: () => void) => {
      if (!params.promptId) {
        throw new Error("Prompt ID is required");
      }
      const { promptInput, templateFormat } = getInstancePromptParamsFromStore(
        instanceId,
        store
      );
      updatePrompt({
        variables: {
          input: {
            promptId: params.promptId,
            promptVersion: {
              ...promptInput,
              templateFormat,
              description: params.description,
            },
          },
        },
        onCompleted: (response) => {
          notifySuccess({
            title: `Prompt successfully updated`,
            action: {
              text: "View Prompt",
              onClick: () => {
                navigate(`/prompts/${response.createChatPromptVersion.id}`);
              },
            },
          });
          onSuccess(
            response.createChatPromptVersion.id,
            response.createChatPromptVersion.name,
            response.createChatPromptVersion.version.id
          );
          close();
        },
        onError: (error) => {
          const message = getErrorMessagesFromRelayMutationError(error);
          notifyError({
            title: "Error updating prompt",
            message: message?.[0],
          });
        },
      });
    },
    [
      instanceId,
      navigate,
      notifyError,
      notifySuccess,
      store,
      updatePrompt,
      onSuccess,
    ]
  );
  return (
    <Dialog>
      {({ close }) => (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Prompt from Template</DialogTitle>
            <DialogTitleExtra>
              <DialogCloseButton />
            </DialogTitleExtra>
          </DialogHeader>
          <Suspense fallback={<Loading />}>
            <SavePromptForm
              onClose={close}
              onCreate={onCreate}
              onUpdate={onUpdate}
              isSubmitting={isCreatePending || isUpdatePending}
              defaultSelectedPromptId={selectedPromptId}
            />
          </Suspense>
        </DialogContent>
      )}
    </Dialog>
  );
};
