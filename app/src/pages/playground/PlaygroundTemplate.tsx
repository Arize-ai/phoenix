import React, { Suspense, useCallback, useState } from "react";

import {
  Card,
  Content,
  Dialog,
  DialogContainer,
  Flex,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { Button, Icon, Icons, Loading } from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { ModelConfigButton } from "./ModelConfigButton";
import { ModelSupportedParamsFetcher } from "./ModelSupportedParamsFetcher";
import { PlaygroundChatTemplate } from "./PlaygroundChatTemplate";
import { PromptComboBox } from "./PromptComboBox";
import { SavePromptForm, SavePromptSubmitHandler } from "./SavePromptForm";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundTemplateProps extends PlaygroundInstanceProps {}

export function PlaygroundTemplate(props: PlaygroundTemplateProps) {
  const [dialog, setDialog] = useState<React.ReactNode>(null);
  const instanceId = props.playgroundInstanceId;
  const instances = usePlaygroundContext((state) => state.instances);
  const instance = instances.find((instance) => instance.id === instanceId);
  const index = instances.findIndex((instance) => instance.id === instanceId);
  const prompt = instance?.prompt;
  const promptId = prompt?.id;
  const updateInstancePrompt = usePlaygroundContext(
    (state) => state.updateInstancePrompt
  );

  // TODO(apowell): Sync instance state with promptId + version (or latest if unset)
  // If it exists, and we can fetch it from gql, replace the instance with it
  // If it doesn't exist, or we can't fetch it from gql, set the promptId to null

  if (!instance) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }
  const { template } = instance;

  return (
    <>
      <Card
        title={
          <Flex
            direction="row"
            gap="size-100"
            alignItems="center"
            marginEnd="size-100"
          >
            <AlphabeticIndexIcon index={index} />
            <PromptComboBox
              promptId={promptId}
              onChange={(nextPromptId) => {
                updateInstancePrompt({
                  instanceId,
                  patch: nextPromptId ? { id: nextPromptId } : null,
                });
              }}
            />
          </Flex>
        }
        collapsible
        variant="compact"
        bodyStyle={{ padding: 0 }}
        extra={
          <Flex direction="row" gap="size-100">
            <Suspense
              fallback={
                <div>
                  <Loading size="S" />
                </div>
              }
            >
              {/* As long as this component mounts, it will sync the supported
              invocation parameters for the model to the instance in the store */}
              <ModelSupportedParamsFetcher instanceId={instanceId} />
            </Suspense>
            <ModelConfigButton {...props} />
            <SaveButton instanceId={instanceId} setDialog={setDialog} />
            {instances.length > 1 ? <DeleteButton {...props} /> : null}
          </Flex>
        }
      >
        {template.__type === "chat" ? (
          <Suspense>
            <PlaygroundChatTemplate {...props} />
          </Suspense>
        ) : (
          "Completion Template"
        )}
      </Card>
      <DialogContainer
        isDismissable
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </>
  );
}

function DeleteButton(props: PlaygroundInstanceProps) {
  const deleteInstance = usePlaygroundContext((state) => state.deleteInstance);
  return (
    <TooltipTrigger>
      <TriggerWrap>
        <Button
          size="S"
          aria-label="Delete this instance of the playground"
          icon={<Icon svg={<Icons.TrashOutline />} />}
          onPress={() => {
            deleteInstance(props.playgroundInstanceId);
          }}
        />
      </TriggerWrap>
      <Tooltip>
        <Content>Delete this instance of the playground</Content>
      </Tooltip>
    </TooltipTrigger>
  );
}

type SaveButtonProps = {
  instanceId: number;
  setDialog: (dialog: React.ReactNode) => void;
};

function SaveButton({ instanceId, setDialog }: SaveButtonProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === instanceId)
  );
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }
  const prompt = instance.prompt;
  const onSubmit: SavePromptSubmitHandler = useCallback(
    (params) => {
      // eslint-disable-next-line no-console
      console.log("saving prompt", instanceId, params);
    },
    [instanceId]
  );
  const onSave = () => {
    setDialog(
      <Dialog title={prompt?.id ? "Update Prompt" : "Save Prompt"}>
        <SavePromptForm onSubmit={onSubmit} />
      </Dialog>
    );
  };
  return (
    <>
      <TooltipTrigger delay={100}>
        <TriggerWrap>
          <Button
            // TODO(apowell): Make variant "primary" when instance is "dirty", aka different from selected prompt
            size="S"
            onPress={onSave}
          >
            Save
          </Button>
        </TriggerWrap>
        <Tooltip>
          <Content>Save this prompt</Content>
        </Tooltip>
      </TooltipTrigger>
    </>
  );
}
