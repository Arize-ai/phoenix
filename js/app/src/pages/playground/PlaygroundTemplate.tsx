import { css } from "@emotion/react";
import { Suspense, useCallback, useMemo } from "react";

import {
  Button,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  ViewportModal,
  ViewportModalOverlay,
  View,
} from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { fetchPlaygroundPromptAsInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { PlaygroundChatTemplate } from "@phoenix/pages/playground/PlaygroundChatTemplate";
import {
  PlaygroundInstanceDeleteButton,
  PlaygroundInstanceModelControls,
} from "@phoenix/pages/playground/PlaygroundInstanceControls";
import { PromptMenu } from "@phoenix/pages/playground/PromptMenu";
import { TaskMenu } from "@phoenix/pages/playground/TaskMenu";
import { UpsertPromptFromTemplateDialog } from "@phoenix/pages/playground/UpsertPromptFromTemplateDialog";

import type { PlaygroundInstanceProps } from "./types";

interface PlaygroundTemplateProps extends PlaygroundInstanceProps {
  appendedMessagesPath?: string | null;
  availablePaths: string[] | undefined;
  /**
   * Pick the task with the playground page's task menu (prompts, evaluators,
   * new drafts) instead of the prompt-only menu the evaluator dialogs use.
   */
  taskMenu?: boolean;
}

export function PlaygroundTemplate(props: PlaygroundTemplateProps) {
  const instanceId = props.playgroundInstanceId;
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const loadInstance = usePlaygroundContext((state) => state.loadInstance);
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
        loadInstance({ instanceId, instance: response.instance });
      }
    },
    [instanceId, updateInstance, loadInstance]
  );

  if (!instance) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }

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

  const { disablePromptMenu, disablePromptSave, disableAlphabeticIndex } =
    props;

  return (
    <>
      <Flex direction="row" justifyContent="space-between">
        <Flex
          direction="row"
          gap="size-100"
          alignItems="center"
          marginEnd="size-100"
          minWidth={0}
          flex="1 1 auto"
          css={css`
            overflow: hidden;
          `}
        >
          {!disableAlphabeticIndex ? (
            <View flex="none">
              <AlphabeticIndexIcon index={index} />
            </View>
          ) : null}
          {disablePromptMenu ? null : props.taskMenu ? (
            <TaskMenu instanceId={instanceId} />
          ) : (
            <PromptMenu value={promptMenuValue} onChange={onChangePrompt} />
          )}
          {!disablePromptSave ? (
            <SaveButton instanceId={instanceId} dirty={dirty} />
          ) : null}
        </Flex>
        <Flex direction="row" gap="size-100" flex="none">
          <PlaygroundInstanceModelControls
            instanceId={instanceId}
            disableEphemeralRouting={props.disableEphemeralRouting}
          />
          {instances.length > 1 ? (
            <PlaygroundInstanceDeleteButton instanceId={instanceId} />
          ) : null}
        </Flex>
      </Flex>
      <View paddingY="size-100">
        {instance.template.__type === "chat" ? (
          <Suspense>
            <PlaygroundChatTemplate {...props} />
          </Suspense>
        ) : (
          "Completion Template"
        )}
      </View>
    </>
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
      <Button
        variant={dirty ? "primary" : undefined}
        size="S"
        leadingVisual={<Icon svg={<Icons.Save />} />}
        aria-label="Save prompt"
      >
        Prompt
      </Button>
      <ViewportModalOverlay>
        <ViewportModal>
          <UpsertPromptFromTemplateDialog
            instanceId={instanceId}
            selectedPromptId={instance.prompt?.id}
          />
        </ViewportModal>
      </ViewportModalOverlay>
    </DialogTrigger>
  );
}
