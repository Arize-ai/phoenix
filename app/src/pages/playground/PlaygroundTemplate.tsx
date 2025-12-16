import { Suspense, useCallback, useMemo } from "react";

import {
  Button,
  Card,
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
import { ModelParametersConfigButton } from "@phoenix/components/playground/model/ModelParametersConfigButton";
import { ModelSupportedParamsFetcher } from "@phoenix/components/playground/model/ModelSupportedParamsFetcher";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { fetchPlaygroundPromptAsInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { PromptMenu } from "@phoenix/pages/playground/PromptMenu";
import { UpsertPromptFromTemplateDialog } from "@phoenix/pages/playground/UpsertPromptFromTemplateDialog";

import { ModelConfigButton } from "./ModelConfigButton";
import { PlaygroundChatTemplate } from "./PlaygroundChatTemplate";
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
  const promptVersionId = prompt?.version;
  const promptTagName = prompt?.tag ?? null;
  const dirty = usePlaygroundContext(
    (state) => state.dirtyInstances[instanceId]
  );

  const onChangePrompt = useCallback(
    async ({
      promptId,
      promptVersionId,
      promptTagName,
    }: {
      promptId: string | null;
      promptVersionId: string | null;
      promptTagName: string | null;
    }) => {
      if (!promptId && !promptVersionId && !promptTagName) {
        const patch = { prompt: null };
        updateInstance({ instanceId, patch, dirty: false });
        return;
      }

      const response = await fetchPlaygroundPromptAsInstance({
        promptId,
        promptVersionId,
        tagName: promptTagName,
      });
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

  // A prompt is "selected" in the PromptMenu when both a promptId and promptVersionId
  // are available in the instance
  const promptMenuValue = useMemo(() => {
    if (!promptId || !promptVersionId) return null;
    return {
      promptId,
      promptVersionId,
      promptTagName,
    };
  }, [promptId, promptVersionId, promptTagName]);

  const { disablePromptMenu, disablePromptSave } = props;

  return (
    <>
      <Card
        title={
          <StopPropagation>
            <Flex
              direction="row"
              gap="size-100"
              alignItems="center"
              marginEnd="size-100"
            >
              <AlphabeticIndexIcon index={index} />
              {!disablePromptMenu ? (
                <PromptMenu value={promptMenuValue} onChange={onChangePrompt} />
              ) : null}
            </Flex>
          </StopPropagation>
        }
        collapsible
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
            <ModelParametersConfigButton playgroundInstanceId={instanceId} />
            {!disablePromptSave ? (
              <SaveButton instanceId={instanceId} dirty={dirty} />
            ) : null}
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
        Delete this instance of the playground
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
      <Button variant={dirty ? "primary" : undefined} size="S">
        Save Prompt
      </Button>
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
