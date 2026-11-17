import { css } from "@emotion/react";
import { Suspense } from "react";

import {
  Button,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  ViewportModal,
  ViewportModalOverlay,
  View,
} from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { DecisionPromptEditor } from "@phoenix/components/decision/DecisionPromptEditor";
import { PlaygroundInstanceModelControls } from "@phoenix/components/playground/model/PlaygroundInstanceModelControls";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { NUM_MAX_PLAYGROUND_INSTANCES } from "@phoenix/pages/playground/constants";
import { DuplicateAsChatButton } from "@phoenix/pages/playground/DuplicateAsChatButton";
import { PlaygroundChatTemplate } from "@phoenix/pages/playground/PlaygroundChatTemplate";
import { PlaygroundInstanceDeleteButton } from "@phoenix/pages/playground/PlaygroundInstanceDeleteButton";
import { SaveDecisionDialog } from "@phoenix/pages/playground/SaveDecisionDialog";
import { TaskMenu } from "@phoenix/pages/playground/TaskMenu";
import { UpsertPromptFromTemplateDialog } from "@phoenix/pages/playground/UpsertPromptFromTemplateDialog";
import { isDecisionInstance } from "@phoenix/store/playground";

import type { PlaygroundInstanceProps } from "./types";

const taskHeaderStartCSS = css`
  overflow: hidden;
`;

interface PlaygroundTemplateProps extends PlaygroundInstanceProps {
  appendedMessagesPath?: string | null;
  availablePaths: string[] | undefined;
}

/**
 * One task column of the playground page: its task menu, save and model
 * controls, and the editor for its prompt or decision.
 */
export function PlaygroundTemplate({
  playgroundInstanceId: instanceId,
  appendedMessagesPath,
  availablePaths,
}: PlaygroundTemplateProps) {
  const instances = usePlaygroundContext((state) => state.instances);
  const instance = instances.find((instance) => instance.id === instanceId);
  const index = instances.findIndex((instance) => instance.id === instanceId);
  const dirty = usePlaygroundContext(
    (state) => state.dirtyInstances[instanceId]
  );

  if (!instance) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }
  const isDecision = isDecisionInstance(instance);

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
          css={taskHeaderStartCSS}
        >
          <View flex="none">
            <AlphabeticIndexIcon index={index} />
          </View>
          {/* A new prompt task fetches its prompt options; without a boundary
              here that hides the whole playground until they arrive. */}
          <Suspense fallback={<Loading size="S" />}>
            <TaskMenu instanceId={instanceId} />
          </Suspense>
          {isDecision ? (
            <SaveDecisionButton dirty={dirty} instanceId={instanceId} />
          ) : (
            <SaveButton instanceId={instanceId} dirty={dirty} />
          )}
        </Flex>
        <Flex direction="row" gap="size-100" flex="none">
          <PlaygroundInstanceModelControls
            instanceId={instanceId}
            modelTypes="CHAT_OR_DECISION"
          />
          <DuplicateButton playgroundInstanceId={instanceId} />
          {isDecision ? (
            <DuplicateAsChatButton playgroundInstanceId={instanceId} />
          ) : null}
          {instances.length > 1 ? (
            <PlaygroundInstanceDeleteButton instanceId={instanceId} />
          ) : null}
        </Flex>
      </Flex>
      <View paddingY="size-100">
        {isDecision ? (
          <DecisionPromptEditor
            playgroundInstanceId={instanceId}
            availablePaths={availablePaths}
          />
        ) : instance.template.__type === "chat" ? (
          <Suspense>
            <PlaygroundChatTemplate
              playgroundInstanceId={instanceId}
              availablePaths={availablePaths}
              appendedMessagesPath={appendedMessagesPath}
            />
          </Suspense>
        ) : (
          "Completion Template"
        )}
      </View>
    </>
  );
}

/**
 * Add a task that starts as a copy of this one. The page's Add task button
 * copies the first task; this one copies the task it sits on.
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
        aria-label="Duplicate this task"
        leadingVisual={<Icon svg={<Icons.CopyPlus />} />}
        isDisabled={numInstances >= NUM_MAX_PLAYGROUND_INSTANCES || isRunning}
        onPress={() => {
          duplicateInstance(props.playgroundInstanceId);
        }}
      />
      <Tooltip>
        <TooltipArrow />
        Duplicate this task
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

function SaveDecisionButton({ instanceId, dirty }: SaveButtonProps) {
  return (
    <DialogTrigger>
      <Button
        variant={dirty ? "primary" : undefined}
        size="S"
        leadingVisual={<Icon svg={<Icons.Save />} />}
        aria-label="Save decision"
      >
        Decision
      </Button>
      <ViewportModalOverlay>
        <ViewportModal>
          <SaveDecisionDialog instanceId={instanceId} />
        </ViewportModal>
      </ViewportModalOverlay>
    </DialogTrigger>
  );
}
