import { css } from "@emotion/react";
import { Suspense, useCallback, useMemo } from "react";

import {
  Button,
  CompositeField,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  ViewportModal,
  ViewportModalOverlay,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { InvocationParameterSpecsSync } from "@phoenix/components/playground/model/InvocationParameterSpecsSync";
import { ModelParametersConfigButton } from "@phoenix/components/playground/model/ModelParametersConfigButton";
import { PlaygroundModelMenu } from "@phoenix/components/playground/model/PlaygroundModelMenu";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { NUM_MAX_PLAYGROUND_INSTANCES } from "@phoenix/pages/playground/constants";
import { DecisionExportDialog } from "@phoenix/pages/playground/DecisionExportDialog";
import { DecisionImportDialog } from "@phoenix/pages/playground/DecisionImportDialog";
import { DecisionRequestEditor } from "@phoenix/pages/playground/DecisionRequestEditor";
import { fetchPlaygroundPromptAsInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { PlaygroundChatTemplate } from "@phoenix/pages/playground/PlaygroundChatTemplate";
import { PromptMenu } from "@phoenix/pages/playground/PromptMenu";
import { UpsertPromptFromTemplateDialog } from "@phoenix/pages/playground/UpsertPromptFromTemplateDialog";

import type { PlaygroundInstanceProps } from "./types";

interface PlaygroundTemplateProps extends PlaygroundInstanceProps {
  appendedMessagesPath?: string | null;
  availablePaths: string[] | undefined;
  /** Enable the Decision tab in this instance's model menu. */
  supportsDecisionModels?: boolean;
  /** Why decision models cannot be chosen right now, shown on the disabled tab. */
  decisionModelsDisabledReason?: string;
}

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
  const isDecision = instance.model.modelType === "DECISION";

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
          {isDecision ? (
            // A decision request has no prompt hub entry yet; paste-in and
            // copy-out take the place of the prompt menu and save.
            <>
              <DecisionImportDialog playgroundInstanceId={instanceId} />
              <DecisionExportDialog playgroundInstanceId={instanceId} />
            </>
          ) : (
            <>
              {!disablePromptMenu ? (
                <PromptMenu value={promptMenuValue} onChange={onChangePrompt} />
              ) : null}
              {!disablePromptSave ? (
                <SaveButton instanceId={instanceId} dirty={dirty} />
              ) : null}
            </>
          )}
        </Flex>
        <Flex direction="row" gap="size-100" flex="none">
          <Suspense
            fallback={
              <div>
                <Loading size="S" />
              </div>
            }
          >
            {/* Keeps instance invocation parameters aligned with the frontend
              spec table when model metadata or saved defaults change. */}
            {!isDecision ? (
              <InvocationParameterSpecsSync instanceId={instanceId} />
            ) : null}
          </Suspense>
          <CompositeField>
            <PlaygroundModelMenu
              playgroundInstanceId={instanceId}
              supportsDecisionModels={props.supportsDecisionModels}
              decisionModelsDisabledReason={props.decisionModelsDisabledReason}
            />
            <ModelParametersConfigButton
              playgroundInstanceId={instanceId}
              disableEphemeralRouting={props.disableEphemeralRouting}
            />
          </CompositeField>
          <DuplicateButton {...props} />
          {instances.length > 1 ? <DeleteButton {...props} /> : null}
        </Flex>
      </Flex>
      <View paddingY="size-100">
        {isDecision ? (
          <DecisionRequestEditor playgroundInstanceId={instanceId} />
        ) : instance.template.__type === "chat" ? (
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

/**
 * Compare against a copy of this instance. The page's Compare button copies
 * the first instance; this one copies the instance it sits on.
 */
function DuplicateButton(props: PlaygroundInstanceProps) {
  const duplicateInstance = usePlaygroundContext(
    (state) => state.duplicateInstance
  );
  const numInstances = usePlaygroundContext((state) => state.instances.length);
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  return (
    <TooltipTrigger>
      <Button
        size="S"
        aria-label="Compare against a copy of this instance"
        leadingVisual={<Icon svg={<Icons.Duplicate />} />}
        isDisabled={numInstances >= NUM_MAX_PLAYGROUND_INSTANCES || isRunning}
        onPress={() => {
          duplicateInstance(props.playgroundInstanceId);
        }}
      />
      <Tooltip>
        <TooltipArrow />
        Compare against a copy of this instance
      </Tooltip>
    </TooltipTrigger>
  );
}

function DeleteButton(props: PlaygroundInstanceProps) {
  const deleteInstance = usePlaygroundContext((state) => state.deleteInstance);
  return (
    <TooltipTrigger>
      <Button
        size="S"
        aria-label="Delete this instance of the playground"
        leadingVisual={<Icon svg={<Icons.Trash />} />}
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
