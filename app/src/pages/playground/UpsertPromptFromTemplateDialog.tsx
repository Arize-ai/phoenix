import React, { Suspense, useCallback } from "react";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";

import { Dialog } from "@arizeai/components";

import { Loading } from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { UpsertPromptFromTemplateDialogCreateMutation } from "@phoenix/pages/playground/__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";
import { UpsertPromptFromTemplateDialogUpdateMutation } from "@phoenix/pages/playground/__generated__/UpsertPromptFromTemplateDialogUpdateMutation.graphql";
import { instanceToPromptVersion } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import {
  SavePromptForm,
  SavePromptSubmitHandler,
} from "@phoenix/pages/playground/SavePromptForm";

type UpsertPromptFromTemplateProps = {
  instanceId: number;
  setDialog: (dialog: React.ReactNode) => void;
  currentPromptId?: string;
};

const getInstancePromptParamsFromStore = (
  instanceId: number,
  store: ReturnType<typeof usePlaygroundStore>
) => {
  const state = store.getState();
  const instance = state.instances.find(
    (instance) => instance.id === instanceId
  );
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }
  const promptInput = instanceToPromptVersion(instance, state.templateLanguage);
  if (!promptInput) {
    throw new Error(`Could not convert instance ${instanceId} to prompt`);
  }
  return { promptInput };
};

export const UpsertPromptFromTemplateDialog = ({
  instanceId,
  setDialog,
  currentPromptId,
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
        }
      }
    `);
  const onCreate: SavePromptSubmitHandler = useCallback(
    (params) => {
      const { promptInput } = getInstancePromptParamsFromStore(
        instanceId,
        store
      );
      createPrompt({
        variables: {
          input: {
            name: params.name,
            description: params.description,
            promptVersion: promptInput,
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
          setDialog(null);
        },
        onError: (error) => {
          // eslint-disable-next-line no-console
          console.error(error);
          notifyError({
            title: "Error creating prompt",
          });
          setDialog(null);
        },
      });
    },
    [
      createPrompt,
      instanceId,
      navigate,
      notifyError,
      notifySuccess,
      setDialog,
      store,
    ]
  );
  const onUpdate: SavePromptSubmitHandler = useCallback(
    (params) => {
      if (!params.promptId) {
        throw new Error("Prompt ID is required");
      }
      const { promptInput } = getInstancePromptParamsFromStore(
        instanceId,
        store
      );
      updatePrompt({
        variables: {
          input: {
            promptId: params.promptId,
            promptVersion: {
              ...promptInput,
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
          setDialog(null);
        },
        onError: (error) => {
          // eslint-disable-next-line no-console
          console.error(error);
          notifyError({
            title: "Error updating prompt",
          });
          setDialog(null);
        },
      });
    },
    [
      instanceId,
      navigate,
      notifyError,
      notifySuccess,
      setDialog,
      store,
      updatePrompt,
    ]
  );
  return (
    <Dialog title="Create Prompt from Template">
      <Suspense fallback={<Loading />}>
        <SavePromptForm
          onCreate={onCreate}
          onUpdate={onUpdate}
          isSubmitting={isCreatePending || isUpdatePending}
          currentPromptId={currentPromptId}
        />
      </Suspense>
    </Dialog>
  );
};
