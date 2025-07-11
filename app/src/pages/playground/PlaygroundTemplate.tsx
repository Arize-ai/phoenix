import { Suspense, useCallback } from "react";

import { Card, Content } from "@arizeai/components";

import {
  Button,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  Modal,
  ModalOverlay,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { fetchPlaygroundPromptAsInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { UpsertPromptFromTemplateDialog } from "@phoenix/pages/playground/UpsertPromptFromTemplateDialog";

import { ModelConfigButton } from "./ModelConfigButton";
import { ModelSupportedParamsFetcher } from "./ModelSupportedParamsFetcher";
import { PlaygroundChatTemplate } from "./PlaygroundChatTemplate";
import { PromptComboBox } from "./PromptComboBox";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundTemplateProps extends PlaygroundInstanceProps {}

export function PlaygroundTemplate(props: PlaygroundTemplateProps) {
  const instanceId = props.playgroundInstanceId;
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const addMessage = usePlaygroundContext((state) => state.addMessage);
  const setDirty = usePlaygroundContext((state) => state.setDirty);
  const instances = usePlaygroundContext((state) => state.instances);
  const instance = instances.find((instance) => instance.id === instanceId);
  const index = instances.findIndex((instance) => instance.id === instanceId);
  const prompt = instance?.prompt;
  const promptId = prompt?.id;
  const dirty = usePlaygroundContext(
    (state) => state.dirtyInstances[instanceId]
  );

  const onChangePrompt = useCallback(
    async (promptId: string | null) => {
      if (!promptId) {
        const patch = { prompt: null };
        updateInstance({ instanceId, patch, dirty: false });
        return;
      }

      const response = await fetchPlaygroundPromptAsInstance(promptId);
      if (response) {
        // delete all message references from the instance
        updateInstance({
          instanceId,
          patch: {
            ...response.instance,
            template: {
              __type: "chat",
              messageIds: [],
            },
          },
          dirty: false,
        });
        // normalize messages and add their references to the instance
        addMessage({
          playgroundInstanceId: instanceId,
          messages: response.instance.template.messages,
        });
        // force reset the dirty state of the instance, unfortunately the addMessage
        // will set it to true again
        setDirty(instanceId, false);
      }
    },
    [instanceId, updateInstance, addMessage, setDirty]
  );

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
            <PromptComboBox promptId={promptId} onChange={onChangePrompt} />
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
            <SaveButton instanceId={instanceId} dirty={dirty} />
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
    </>
  );
}

function DeleteButton(props: PlaygroundInstanceProps) {
  const deleteInstance = usePlaygroundContext((state) => state.deleteInstance);
  return (
    <TooltipTrigger>
      <Button
        size="S"
        aria-label="Delete this instance of the playground"
        leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
        onPress={() => {
          deleteInstance(props.playgroundInstanceId);
        }}
      />
      <Tooltip>
        <TooltipArrow />
        <Content>Delete this instance of the playground</Content>
      </Tooltip>
    </TooltipTrigger>
  );
}

type SaveButtonProps = {
  instanceId: number;
  dirty?: boolean;
};

function SaveButton({ instanceId, dirty }: SaveButtonProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === instanceId)
  );
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }
  return (
    <DialogTrigger>
      <TooltipTrigger delay={100}>
        <Button variant={dirty ? "primary" : undefined} size="S">
          Save
        </Button>
        <Tooltip placement="top">
          <TooltipArrow />
          <Content>Save this prompt</Content>
        </Tooltip>
      </TooltipTrigger>
      <ModalOverlay>
        <Modal>
          <UpsertPromptFromTemplateDialog
            instanceId={instanceId}
            selectedPromptId={instance.prompt?.id}
          />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
