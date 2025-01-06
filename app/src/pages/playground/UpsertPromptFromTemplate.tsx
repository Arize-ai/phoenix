import React, { Suspense, useCallback } from "react";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";

import { Dialog } from "@arizeai/components";

import { Loading } from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { UpsertPromptFromTemplateMutation } from "@phoenix/pages/playground/__generated__/UpsertPromptFromTemplateMutation.graphql";
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

export const UpsertPromptFromTemplate = ({
  instanceId,
  setDialog,
  currentPromptId,
}: UpsertPromptFromTemplateProps) => {
  const navigate = useNavigate();
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const store = usePlaygroundStore();
  const [createPrompt, isCreatePending] =
    useMutation<UpsertPromptFromTemplateMutation>(graphql`
      mutation UpsertPromptFromTemplateMutation(
        $input: CreateChatPromptInput!
      ) {
        createChatPrompt(input: $input) {
          id
          name
        }
      }
    `);
  const onCreate: SavePromptSubmitHandler = useCallback(
    (params) => {
      const state = store.getState();
      const instance = state.instances.find(
        (instance) => instance.id === instanceId
      );
      if (!instance) {
        throw new Error(`Instance ${instanceId} not found`);
      }
      const promptInput = instanceToPromptVersion(
        instance,
        state.templateLanguage
      );
      if (!promptInput) {
        throw new Error(`Could not convert instance ${instanceId} to prompt`);
      }
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
      instanceId,
      store,
      createPrompt,
      navigate,
      notifySuccess,
      notifyError,
      setDialog,
    ]
  );
  return (
    <Dialog title="Create Prompt from Template">
      <Suspense fallback={<Loading />}>
        <SavePromptForm
          onCreate={onCreate}
          // TODO(apowell): Implement update mutation
          onUpdate={() => {}}
          isSubmitting={isCreatePending}
          currentPromptId={currentPromptId}
        />
      </Suspense>
    </Dialog>
  );
};
