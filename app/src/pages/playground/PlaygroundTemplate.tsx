import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { debounce, pick } from "lodash";

import {
  Card,
  Content,
  DialogContainer,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { Button, Flex, Icon, Icons, Loading } from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { fetchPlaygroundPromptAsInstance } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { UpsertPromptFromTemplateDialog } from "@phoenix/pages/playground/UpsertPromptFromTemplateDialog";
import { PlaygroundInstance } from "@phoenix/store";

import { ModelConfigButton } from "./ModelConfigButton";
import { ModelSupportedParamsFetcher } from "./ModelSupportedParamsFetcher";
import { PlaygroundChatTemplate } from "./PlaygroundChatTemplate";
import { PromptComboBox } from "./PromptComboBox";
import { PlaygroundInstanceProps } from "./types";

interface PlaygroundTemplateProps extends PlaygroundInstanceProps {}

export function PlaygroundTemplate(props: PlaygroundTemplateProps) {
  const dirtyRef = useRef<null | Partial<PlaygroundInstance>>(null);
  const [dirty, setDirty] = useState(false);
  const [dialog, setDialog] = useState<React.ReactNode>(null);
  const instanceId = props.playgroundInstanceId;
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const instances = usePlaygroundContext((state) => state.instances);
  const store = usePlaygroundStore();
  const instance = instances.find((instance) => instance.id === instanceId);
  const index = instances.findIndex((instance) => instance.id === instanceId);
  const prompt = instance?.prompt;
  const promptId = prompt?.id;

  const onChangePrompt = useCallback(
    async (promptId: string | null) => {
      dirtyRef.current = null;
      if (!promptId) {
        updateInstance({
          instanceId,
          patch: {
            prompt: null,
          },
        });
        return;
      }

      const response = await fetchPlaygroundPromptAsInstance(promptId);
      if (response) {
        updateInstance({
          instanceId,
          patch: {
            ...response.instance,
          },
        });
      }
    },
    [instanceId, updateInstance]
  );

  const debounceDirtyCheck = useMemo(
    () =>
      // eslint-disable-next-line react-compiler/react-compiler
      debounce((ref: typeof dirtyRef.current) => {
        if (!ref) {
          return false;
        }
        const state = store.getState();
        const instance = state.instances.find(
          (instance) => instance.id === instanceId
        );
        if (!instance) {
          return false;
        }
        const observedKeys: (keyof PlaygroundInstance)[] = [
          "model",
          "tools",
          "toolChoice",
          "template",
        ] as const;
        let original = pick(dirtyRef.current, observedKeys);
        // delete model.supportedInvocationParameters to avoid diffs on transient field
        if (original.model) {
          original = {
            ...original,
            model: {
              ...original.model,
              supportedInvocationParameters: [],
              invocationParameters: [],
            },
          };
        }
        // delete model.supportedInvocationParameters to avoid diffs on transient field
        let current = pick(instance, observedKeys);
        if (current.model) {
          current = {
            ...current,
            model: {
              ...current.model,
              supportedInvocationParameters: [],
              invocationParameters: [],
            },
          };
        }
        const isDirty = JSON.stringify(original) !== JSON.stringify(current);
        setDirty(isDirty);
      }, 1000),
    [store, instanceId]
  );

  useEffect(() => {
    if (!instance) {
      return;
    }
    if (!dirtyRef.current) {
      dirtyRef.current = instance;
    }
    debounceDirtyCheck(dirtyRef.current);
  }, [instance, debounceDirtyCheck]);

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
            <SaveButton
              instanceId={instanceId}
              setDialog={setDialog}
              dirty={dirty}
            />
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
  dirty: boolean;
};

function SaveButton({ instanceId, setDialog, dirty }: SaveButtonProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === instanceId)
  );
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }

  const onSave = () => {
    setDialog(
      <UpsertPromptFromTemplateDialog
        instanceId={instanceId}
        setDialog={setDialog}
        selectedPromptId={instance.prompt?.id}
      />
    );
  };

  return (
    <>
      <TooltipTrigger delay={100}>
        <TriggerWrap>
          <Button
            variant={dirty ? "primary" : undefined}
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
