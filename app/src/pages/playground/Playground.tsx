import { css } from "@emotion/react";
import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { Group, useDefaultLayout } from "react-resizable-panels";
import type { BlockerFunction } from "react-router";
import { useBlocker, useSearchParams } from "react-router";

import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import {
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
  READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import {
  EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  OPEN_LLM_EVALUATOR_FORM_TOOL_NAME,
  READ_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME,
} from "@phoenix/agent/tools/llmEvaluatorDraft";
import {
  createSetAppendedMessagesPathClientAction,
  SET_APPENDED_MESSAGES_PATH_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundAppendedMessagesPath";
import {
  createSetPlaygroundExperimentRecordingClientAction,
  SET_PLAYGROUND_EXPERIMENT_RECORDING_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundExperimentRecording";
import {
  createLoadDatasetClientAction,
  LOAD_DATASET_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundLoadDataset";
import {
  createListPlaygroundModelTargetsClientAction,
  createSetPlaygroundModelClientAction,
  LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME,
  SET_PLAYGROUND_MODEL_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundModel";
import {
  createReadPlaygroundOutputClientAction,
  READ_PLAYGROUND_OUTPUT_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundOutput";
import {
  ADD_PROMPT_INSTANCE_TOOL_NAME,
  CLONE_PROMPT_INSTANCE_TOOL_NAME,
  createAddPromptInstanceClientAction,
  createClonePromptInstanceClientAction,
  createEditPromptClientAction,
  createReadPromptClientAction,
  createRemovePromptInstanceClientAction,
  EDIT_PROMPT_TOOL_NAME,
  READ_PROMPT_TOOL_NAME,
  REMOVE_PROMPT_INSTANCE_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPrompt";
import {
  createReadPromptToolsClientAction,
  createWritePromptToolsClientAction,
  READ_PROMPT_TOOLS_TOOL_NAME,
  WRITE_PROMPT_TOOLS_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPromptTools";
import {
  createSetPlaygroundRepetitionsClientAction,
  SET_PLAYGROUND_REPETITIONS_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundRepetitions";
import {
  CANCEL_PLAYGROUND_RUN_TOOL_NAME,
  createCancelPlaygroundRunClientAction,
  createRunPlaygroundClientAction,
  RUN_PLAYGROUND_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundRun";
import {
  createSavePromptClientAction,
  SAVE_PROMPT_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundSavePrompt";
import {
  createSetTemplateVariablesPathClientAction,
  SET_TEMPLATE_VARIABLES_PATH_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundTemplateVariablesPath";
import {
  createSetVariableValuesClientAction,
  SET_VARIABLE_VALUES_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundVariableValues";
import {
  Button,
  Flex,
  Icon,
  Icons,
  Loading,
  PageHeader,
  View,
} from "@phoenix/components";
import { ConfirmNavigationDialog } from "@phoenix/components/ConfirmNavigation";
import { useModelMenuData } from "@phoenix/components/generative";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import {
  PlaygroundProvider,
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { ConfirmExperimentNavigationDialog } from "@phoenix/pages/playground/ConfirmExperimentNavigationDialog";
import { PlaygroundExamplePage } from "@phoenix/pages/playground/PlaygroundExamplePage";
import type { PromptParam } from "@phoenix/pages/playground/playgroundURLSearchParamsUtils";
import {
  resolvePlaygroundDatasetId,
  setPromptParams,
} from "@phoenix/pages/playground/playgroundURLSearchParamsUtils";
import type { PlaygroundProps } from "@phoenix/store";
import {
  type AgentClientActionResult,
  waitForRegisteredClientActions,
} from "@phoenix/store/agentStore";

import type { PlaygroundQuery } from "./__generated__/PlaygroundQuery.graphql";
import { NUM_MAX_PLAYGROUND_INSTANCES } from "./constants";
import { NoInstalledProvider } from "./NoInstalledProvider";
import {
  areExperimentScaffoldsForAgentEqual,
  arePlaygroundInstancesForAgentEqual,
  buildPlaygroundAgentContext,
  getExperimentScaffoldForAgent,
  getPlaygroundInstanceForAgent,
} from "./playgroundAgentContextUtils";
import { PlaygroundConfigButton } from "./PlaygroundConfigButton";
import { PlaygroundCredentialsDropdown } from "./PlaygroundCredentialsDropdown";
import {
  IO_PANEL_PROPS,
  PlaygroundDatasetSection,
} from "./PlaygroundDatasetSection";
import { PlaygroundDatasetSelect } from "./PlaygroundDatasetSelect";
import { PlaygroundInput } from "./PlaygroundInput";
import { PlaygroundOutput } from "./PlaygroundOutput";
import { PlaygroundRunButton } from "./PlaygroundRunButton";
import { PlaygroundTemplate } from "./PlaygroundTemplate";
import { TemplateFormatRadioGroup } from "./TemplateFormatRadioGroup";
import { useCancelPlaygroundRun } from "./useCancelPlaygroundRun";

const playgroundWrapCSS = css`
  display: flex;
  overflow: hidden;
  flex-direction: column;
  height: 100%;
`;

export function Playground(
  props: Partial<PlaygroundProps> & {
    datasetId?: string | null;
    selectedDatasetEvaluatorIds?: string[];
  }
) {
  const [searchParams] = useSearchParams();
  const datasetId = resolvePlaygroundDatasetId({
    searchParams,
    storeDatasetId: props.datasetId ?? null,
  });

  const { modelProviders } = useLazyLoadQuery<PlaygroundQuery>(
    graphql`
      query PlaygroundQuery {
        modelProviders {
          name
          dependenciesInstalled
          dependencies
        }
      }
    `,
    {}
  );

  const modelConfigByProvider = usePreferencesContext(
    (state) => state.modelConfigByProvider
  );
  const defaultModelProvider = usePreferencesContext(
    (state) => state.defaultModelProvider
  );
  const defaultModelName = usePreferencesContext(
    (state) => state.defaultModelName
  );

  const playgroundStreamingEnabled = usePreferencesContext(
    (state) => state.playgroundStreamingEnabled
  );
  const hasInstalledProvider = modelProviders.some(
    (provider) => provider.dependenciesInstalled
  );

  if (!hasInstalledProvider) {
    return <NoInstalledProvider availableProviders={modelProviders} />;
  }
  return (
    <PlaygroundProvider
      {...props}
      datasetId={datasetId}
      streaming={playgroundStreamingEnabled}
      modelConfigByProvider={modelConfigByProvider}
      defaultModelProvider={defaultModelProvider}
      defaultModelName={defaultModelName}
    >
      <div css={playgroundWrapCSS}>
        <View borderBottomColor="default" borderBottomWidth="thin">
          <PageHeader
            title="Playground"
            extra={
              <Flex direction="row" gap="size-100" alignItems="center">
                <PlaygroundCredentialsDropdown />
                <PlaygroundConfigButton />
                <PlaygroundRunButton />
              </Flex>
            }
          />
        </View>
        <PlaygroundContent />
      </div>
      <Suspense>
        <PlaygroundExamplePage />
      </Suspense>
    </PlaygroundProvider>
  );
}

function AddPromptButton() {
  const addInstance = usePlaygroundContext((state) => state.addInstance);
  const instances = usePlaygroundContext((state) => state.instances);
  const numInstances = instances.length;
  const isRunning = instances.some((instance) => instance.activeRunId != null);
  return (
    <Button
      size="S"
      aria-label="add prompt"
      leadingVisual={<Icon svg={<Icons.PlusCircle />} />}
      isDisabled={numInstances >= NUM_MAX_PLAYGROUND_INSTANCES || isRunning}
      onPress={() => {
        addInstance();
      }}
    >
      Compare
    </Button>
  );
}

const promptsWrapCSS = css`
  padding: var(--global-dimension-size-200);
  scrollbar-gutter: stable;
  height: 100%;
  flex: 1 1 auto;
  overflow: auto;
  box-sizing: border-box;
`;

/**
 * This width accomodates the model config button min-width, as well as chat message accordion
 * header contents such as the chat message mode radio group for AI messages
 */
const PLAYGROUND_PROMPT_PANEL_MIN_WIDTH = 632;

function PlaygroundContent() {
  const agentStore = useAgentStore();
  const playgroundStore = usePlaygroundStore();
  const cancelPlaygroundRun = useCancelPlaygroundRun();
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const storeDatasetId = usePlaygroundContext((state) => state.datasetId);
  const datasetId = resolvePlaygroundDatasetId({
    searchParams,
    storeDatasetId,
  });
  // Only depend on the split-id subset of query params.
  const serializedSplitIds = searchParams.getAll("splitId").join("\0");
  // Keep splitIds referentially stable unless split-id values actually change.
  const splitIds = useMemo(() => {
    // Pass undefined instead of empty array to indicate "no filter"
    if (serializedSplitIds.length === 0) {
      return undefined;
    }
    return serializedSplitIds.split("\0");
  }, [serializedSplitIds]);
  const isDatasetMode = datasetId != null;
  const [codeEvaluatorFormDatasetId, setCodeEvaluatorFormDatasetId] = useState<
    string | null
  >(null);
  const isCodeEvaluatorFormOpen =
    datasetId != null && codeEvaluatorFormDatasetId === datasetId;
  const [llmEvaluatorFormDatasetId, setLlmEvaluatorFormDatasetId] = useState<
    string | null
  >(null);
  const isLlmEvaluatorFormOpen =
    datasetId != null && llmEvaluatorFormDatasetId === datasetId;
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  const runningExperiment = usePlaygroundContext((state) => {
    const instance = state.instances.find(
      (inst) => inst.activeRunId != null && inst.experiment != null
    );
    return instance?.experiment ?? null;
  });
  const anyDirtyPromptInstances = usePlaygroundContext((state) =>
    Object.values(state.dirtyInstances).some((dirty) => dirty)
  );
  const recordExperiments = usePlaygroundContext(
    (state) => state.recordExperiments
  );
  const repetitions = usePlaygroundContext((state) => state.repetitions);
  const experimentScaffoldForAgent = usePlaygroundContext(
    (state) => getExperimentScaffoldForAgent(state.nextExperimentScaffold),
    areExperimentScaffoldsForAgentEqual
  );
  const playgroundInstancesForAgent = usePlaygroundContext(
    (state) =>
      state.instances.map((instance) =>
        getPlaygroundInstanceForAgent(instance)
      ),
    arePlaygroundInstancesForAgentEqual
  );
  const instanceIds = usePlaygroundContext(
    (state) => state.instances.map((instance) => instance.id),
    // only re-render when the instance ids change, not when the array is re-created
    (left, right) =>
      left.length === right.length &&
      left.every((id, index) => id === right[index])
  );
  const modelConfigByProvider = usePreferencesContext(
    (state) => state.modelConfigByProvider
  );
  const awsBedrockModelPrefix = usePreferencesContext(
    (state) => state.awsBedrockModelPrefix
  );

  const { availableBuiltinModels, availableCustomModels, modelCatalog } =
    useModelMenuData();

  const advertisedPlaygroundContext = useMemo(
    () =>
      buildPlaygroundAgentContext({
        recordExperiments,
        repetitions,
        nextExperimentScaffold: experimentScaffoldForAgent,
        instances: playgroundInstancesForAgent,
      }),
    [
      playgroundInstancesForAgent,
      recordExperiments,
      repetitions,
      experimentScaffoldForAgent,
    ]
  );
  useAdvertiseAgentContext(advertisedPlaygroundContext);

  const advertisedDatasetContext = useMemo(
    () =>
      datasetId
        ? {
            type: "dataset" as const,
            datasetNodeId: datasetId,
            datasetVersionNodeId: null,
          }
        : null,
    [datasetId]
  );
  useAdvertiseAgentContext(advertisedDatasetContext);

  useEffect(() => {
    const {
      registerClientAction,
      unregisterClientAction,
      setPendingPromptEdit,
      setPendingPromptInstanceRemoval,
      setPendingSavePrompt,
      setPendingLoadDataset,
      setPendingPromptToolWrite,
    } = agentStore.getState();
    registerClientAction(
      READ_PROMPT_TOOL_NAME,
      createReadPromptClientAction({ playgroundStore })
    );
    registerClientAction(
      CLONE_PROMPT_INSTANCE_TOOL_NAME,
      createClonePromptInstanceClientAction({ playgroundStore })
    );
    registerClientAction(
      ADD_PROMPT_INSTANCE_TOOL_NAME,
      createAddPromptInstanceClientAction({ playgroundStore })
    );
    registerClientAction(
      REMOVE_PROMPT_INSTANCE_TOOL_NAME,
      createRemovePromptInstanceClientAction({
        playgroundStore,
        setPendingPromptInstanceRemoval,
        shouldAutoAccept: () =>
          agentStore.getState().permissions.edits === "bypass",
      })
    );
    registerClientAction(
      EDIT_PROMPT_TOOL_NAME,
      createEditPromptClientAction({
        playgroundStore,
        setPendingPromptEdit,
        shouldAutoAccept: () =>
          agentStore.getState().permissions.edits === "bypass",
      })
    );
    registerClientAction(
      SAVE_PROMPT_TOOL_NAME,
      createSavePromptClientAction({
        playgroundStore,
        setPendingSavePrompt,
        shouldAutoAccept: () =>
          agentStore.getState().permissions.edits === "bypass",
      })
    );
    registerClientAction(
      RUN_PLAYGROUND_TOOL_NAME,
      createRunPlaygroundClientAction({ playgroundStore })
    );
    registerClientAction(
      READ_PLAYGROUND_OUTPUT_TOOL_NAME,
      createReadPlaygroundOutputClientAction({ playgroundStore })
    );
    registerClientAction(
      SET_VARIABLE_VALUES_TOOL_NAME,
      createSetVariableValuesClientAction({ playgroundStore })
    );
    registerClientAction(
      SET_PLAYGROUND_EXPERIMENT_RECORDING_TOOL_NAME,
      createSetPlaygroundExperimentRecordingClientAction({ playgroundStore })
    );
    registerClientAction(
      SET_PLAYGROUND_REPETITIONS_TOOL_NAME,
      createSetPlaygroundRepetitionsClientAction({ playgroundStore })
    );
    registerClientAction(
      SET_TEMPLATE_VARIABLES_PATH_TOOL_NAME,
      createSetTemplateVariablesPathClientAction({
        playgroundStore,
        getSearchParams: () => searchParamsRef.current,
      })
    );
    registerClientAction(
      LOAD_DATASET_TOOL_NAME,
      createLoadDatasetClientAction({
        playgroundStore,
        setSearchParams,
        getSearchParams: () => searchParamsRef.current,
        setPendingLoadDataset,
        shouldAutoAccept: () =>
          agentStore.getState().permissions.edits === "bypass",
      })
    );
    registerClientAction(
      READ_PROMPT_TOOLS_TOOL_NAME,
      createReadPromptToolsClientAction({ playgroundStore })
    );
    registerClientAction(
      WRITE_PROMPT_TOOLS_TOOL_NAME,
      createWritePromptToolsClientAction({
        playgroundStore,
        setPendingPromptToolWrite,
        shouldAutoAccept: () =>
          agentStore.getState().permissions.edits === "bypass",
      })
    );
    registerClientAction(
      SET_APPENDED_MESSAGES_PATH_TOOL_NAME,
      createSetAppendedMessagesPathClientAction({
        playgroundStore,
        getSearchParams: () => searchParamsRef.current,
      })
    );
    return () => {
      unregisterClientAction(READ_PROMPT_TOOL_NAME);
      unregisterClientAction(CLONE_PROMPT_INSTANCE_TOOL_NAME);
      unregisterClientAction(ADD_PROMPT_INSTANCE_TOOL_NAME);
      unregisterClientAction(REMOVE_PROMPT_INSTANCE_TOOL_NAME);
      unregisterClientAction(EDIT_PROMPT_TOOL_NAME);
      unregisterClientAction(SAVE_PROMPT_TOOL_NAME);
      unregisterClientAction(RUN_PLAYGROUND_TOOL_NAME);
      unregisterClientAction(READ_PLAYGROUND_OUTPUT_TOOL_NAME);
      unregisterClientAction(SET_VARIABLE_VALUES_TOOL_NAME);
      unregisterClientAction(SET_PLAYGROUND_EXPERIMENT_RECORDING_TOOL_NAME);
      unregisterClientAction(SET_PLAYGROUND_REPETITIONS_TOOL_NAME);
      unregisterClientAction(SET_TEMPLATE_VARIABLES_PATH_TOOL_NAME);
      unregisterClientAction(LOAD_DATASET_TOOL_NAME);
      unregisterClientAction(READ_PROMPT_TOOLS_TOOL_NAME);
      unregisterClientAction(WRITE_PROMPT_TOOLS_TOOL_NAME);
      unregisterClientAction(SET_APPENDED_MESSAGES_PATH_TOOL_NAME);
      for (const pendingEdit of Object.values(
        agentStore.getState().pendingPromptEditsByToolCallId
      )) {
        if (pendingEdit) {
          void pendingEdit.cancel?.();
        }
      }
      for (const pendingRemoval of Object.values(
        agentStore.getState().pendingPromptInstanceRemovalsByToolCallId
      )) {
        if (pendingRemoval) {
          void pendingRemoval.cancel?.();
        }
      }
      for (const pendingSave of Object.values(
        agentStore.getState().pendingSavePromptsByToolCallId
      )) {
        if (pendingSave) {
          void pendingSave.cancel?.();
        }
      }
      for (const pendingLoad of Object.values(
        agentStore.getState().pendingLoadDatasetsByToolCallId
      )) {
        if (pendingLoad) {
          void pendingLoad.cancel?.();
        }
      }
      for (const pendingWrite of Object.values(
        agentStore.getState().pendingPromptToolWritesByToolCallId
      )) {
        if (pendingWrite) {
          void pendingWrite.cancel?.();
        }
      }
    };
  }, [agentStore, playgroundStore, setSearchParams]);

  useEffect(() => {
    const { registerClientAction, unregisterClientAction } =
      agentStore.getState();
    registerClientAction(
      CANCEL_PLAYGROUND_RUN_TOOL_NAME,
      createCancelPlaygroundRunClientAction({
        playgroundStore,
        cancelRun: cancelPlaygroundRun,
      })
    );
    return () => {
      unregisterClientAction(CANCEL_PLAYGROUND_RUN_TOOL_NAME);
    };
  }, [agentStore, cancelPlaygroundRun, playgroundStore]);

  useEffect(() => {
    const { registerClientAction, unregisterClientAction } =
      agentStore.getState();
    registerClientAction(
      LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME,
      createListPlaygroundModelTargetsClientAction({
        availableBuiltinModels,
        availableCustomModels,
      })
    );
    registerClientAction(
      SET_PLAYGROUND_MODEL_TOOL_NAME,
      createSetPlaygroundModelClientAction({
        playgroundStore,
        modelCatalog,
        modelConfigByProvider,
        awsBedrockModelPrefix,
      })
    );
    return () => {
      unregisterClientAction(LIST_PLAYGROUND_MODEL_TARGETS_TOOL_NAME);
      unregisterClientAction(SET_PLAYGROUND_MODEL_TOOL_NAME);
    };
  }, [
    agentStore,
    availableBuiltinModels,
    availableCustomModels,
    awsBedrockModelPrefix,
    modelCatalog,
    modelConfigByProvider,
    playgroundStore,
  ]);

  useEffect(() => {
    const { registerClientAction, unregisterClientAction } =
      agentStore.getState();
    if (!datasetId) {
      return;
    }
    registerClientAction(
      OPEN_CODE_EVALUATOR_FORM_TOOL_NAME,
      async (): Promise<AgentClientActionResult> => {
        if (isRunning) {
          return {
            ok: false,
            error:
              "The playground is running an experiment; wait for it to finish before opening the code-evaluator form.",
          };
        }
        setCodeEvaluatorFormDatasetId(datasetId);
        const isReady = await waitForRegisteredClientActions({
          agentStore,
          names: [
            READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
            EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
            TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
          ],
        });
        if (!isReady) {
          return {
            ok: false,
            error:
              "The code-evaluator form opened, but its draft tools did not finish loading. Try opening the form again before reading the draft.",
          };
        }
        return {
          ok: true,
          output:
            "Code-evaluator form opened for the current playground dataset; draft tools are ready.",
        };
      }
    );
    registerClientAction(
      OPEN_LLM_EVALUATOR_FORM_TOOL_NAME,
      async (): Promise<AgentClientActionResult> => {
        if (isRunning) {
          return {
            ok: false,
            error:
              "The playground is running an experiment; wait for it to finish before opening the LLM-evaluator form.",
          };
        }
        setLlmEvaluatorFormDatasetId(datasetId);
        const isReady = await waitForRegisteredClientActions({
          agentStore,
          names: [
            READ_LLM_EVALUATOR_DRAFT_TOOL_NAME,
            EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
            TEST_LLM_EVALUATOR_DRAFT_TOOL_NAME,
          ],
        });
        if (!isReady) {
          return {
            ok: false,
            error:
              "The LLM-evaluator form opened, but its draft tools did not finish loading. Try opening the form again before reading the draft.",
          };
        }
        return {
          ok: true,
          output:
            "LLM-evaluator form opened for the current playground dataset; draft tools are ready.",
        };
      }
    );
    return () => {
      unregisterClientAction(OPEN_CODE_EVALUATOR_FORM_TOOL_NAME);
      unregisterClientAction(OPEN_LLM_EVALUATOR_FORM_TOOL_NAME);
    };
  }, [agentStore, datasetId, isRunning]);

  const playgroundDatasetStateByDatasetId = usePlaygroundContext(
    (state) => state.stateByDatasetId
  );
  const playgroundDatasetState = datasetId
    ? playgroundDatasetStateByDatasetId[datasetId]
    : null;
  const { appendedMessagesPath, availablePaths } = playgroundDatasetState ?? {};

  // Derive prompt params from all instances for URL sync.
  // Only re-render when the prompt params actually change.
  const instancePromptParams = usePlaygroundContext(
    (state) =>
      state.instances
        .map((instance): PromptParam | null =>
          instance.prompt
            ? {
                promptId: instance.prompt.id,
                promptVersionId: instance.prompt.version,
                tagName: instance.prompt.tag,
              }
            : null
        )
        .filter((param): param is PromptParam => param != null),
    (left, right) =>
      left.length === right.length &&
      left.every(
        (param, index) =>
          param.promptId === right[index].promptId &&
          param.promptVersionId === right[index].promptVersionId &&
          param.tagName === right[index].tagName
      )
  );

  // Sync prompt state from the store to URL search params.
  // Uses replace to avoid polluting browser history.
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        setPromptParams({ searchParams: next, prompts: instancePromptParams });
        return next;
      },
      { replace: true }
    );
  }, [instancePromptParams, setSearchParams]);

  // Soft block at the router level:
  // - Ephemeral experiment running: will stop on disconnect, user must stay or accept
  // - Non-ephemeral experiment running: daemon continues, but ask if user wants to stop
  // - Dirty prompts: unsaved changes warning
  const shouldBlockUnload = useCallback(
    ({ currentLocation, nextLocation }: Parameters<BlockerFunction>[0]) => {
      const goingToNewPage = currentLocation.pathname !== nextLocation.pathname;
      return (isRunning || anyDirtyPromptInstances) && goingToNewPage;
    },
    [isRunning, anyDirtyPromptInstances]
  );
  const blocker = useBlocker(shouldBlockUnload);

  // Hard block at the browser level when an experiment is running
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = true;
    };

    if (isRunning) {
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }
  }, [isRunning]);

  // The mounted panel set varies by mode; passing panelIds keys each mode's
  // saved layout separately so switching modes doesn't clobber the other's
  const panelIds = useMemo(
    () =>
      isDatasetMode
        ? ["prompts", "io"]
        : templateFormat !== TemplateFormats.NONE
          ? ["prompts", "input", "output"]
          : ["prompts", "output"],
    [isDatasetMode, templateFormat]
  );
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "playground-panels-v2",
    panelIds,
    storage: localStorage,
  });

  const promptsPanelRef = useRef<PanelImperativeHandle | null>(null);
  const inputsPanelRef = useRef<PanelImperativeHandle | null>(null);
  const ioPanelRef = useRef<PanelImperativeHandle | null>(null);

  // Never leave every section collapsed — expand the opposite section so the
  // page always has a focused area
  const handleSectionCollapse = (
    collapsed: boolean,
    section: "prompts" | "inputs" | "io"
  ) => {
    if (!collapsed) {
      return;
    }
    const panels = [promptsPanelRef, inputsPanelRef, ioPanelRef]
      .map((panelRef) => panelRef.current)
      .filter((panel) => panel != null);
    if (!panels.every((panel) => panel.isCollapsed())) {
      return;
    }
    const fallbackPanelRef =
      section === "prompts" ? ioPanelRef : promptsPanelRef;
    fallbackPanelRef.current?.expand();
  };

  return (
    <Fragment key="playground-content">
      <Group
        orientation="vertical"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <TitledPanel
          ref={promptsPanelRef}
          headingLevel={2}
          title="Prompts"
          extra={
            <Flex direction="row" gap="size-100" alignItems="center">
              <TemplateFormatRadioGroup size="S" />
              <AddPromptButton />
            </Flex>
          }
          panelProps={{ id: "prompts", minSize: "15%" }}
          onCollapseChange={(collapsed) =>
            handleSectionCollapse(collapsed, "prompts")
          }
        >
          <div css={promptsWrapCSS}>
            <Flex direction="row" gap="size-200" maxWidth="100%">
              {instanceIds.map((instanceId) => (
                <View
                  flex="1 1 0px"
                  key={`${instanceId}-prompt`}
                  minWidth={PLAYGROUND_PROMPT_PANEL_MIN_WIDTH}
                >
                  <PlaygroundTemplate
                    playgroundInstanceId={instanceId}
                    appendedMessagesPath={appendedMessagesPath}
                    availablePaths={availablePaths}
                  />
                </View>
              ))}
            </Flex>
          </div>
        </TitledPanel>
        {isDatasetMode ? (
          <Suspense
            fallback={
              // Render the same TitledPanel the resolved section renders, so the
              // layout doesn't jump and — critically — the io panel is registered
              // as `collapsible`. A plain Panel would make a persisted collapsed
              // (0%) layout illegal, clamping it to minSize and re-persisting it.
              <TitledPanel
                disabled
                resizable
                headingLevel={2}
                title="Experiment"
                panelProps={IO_PANEL_PROPS}
              >
                <Loading />
              </TitledPanel>
            }
          >
            <PlaygroundDatasetSection
              key={datasetId} // reset evaluator selection when dataset changes
              datasetId={datasetId}
              splitIds={splitIds}
              panelRef={ioPanelRef}
              onPanelCollapseChange={(collapsed) =>
                handleSectionCollapse(collapsed, "io")
              }
              isCodeEvaluatorFormOpen={isCodeEvaluatorFormOpen}
              onCodeEvaluatorFormOpenChange={(isOpen) =>
                setCodeEvaluatorFormDatasetId(isOpen ? datasetId : null)
              }
              isLlmEvaluatorFormOpen={isLlmEvaluatorFormOpen}
              onLlmEvaluatorFormOpenChange={(isOpen) =>
                setLlmEvaluatorFormDatasetId(isOpen ? datasetId : null)
              }
            />
          </Suspense>
        ) : (
          <>
            {templateFormat !== TemplateFormats.NONE ? (
              <TitledPanel
                ref={inputsPanelRef}
                headingLevel={2}
                resizable
                title="Inputs"
                extra={<PlaygroundDatasetSelect />}
                panelProps={{ id: "input", minSize: "10%" }}
                onCollapseChange={(collapsed) =>
                  handleSectionCollapse(collapsed, "inputs")
                }
              >
                <View padding="size-200" height="100%" overflow="auto">
                  <PlaygroundInput />
                </View>
              </TitledPanel>
            ) : null}
            <TitledPanel
              ref={ioPanelRef}
              headingLevel={2}
              resizable
              title="Output"
              panelProps={{ id: "output", minSize: "15%" }}
              onCollapseChange={(collapsed) =>
                handleSectionCollapse(collapsed, "io")
              }
            >
              <View padding="size-200" height="100%" overflow="auto">
                <Flex direction="row" gap="size-200">
                  {instanceIds.map((instanceId) => (
                    <View key={`${instanceId}-output`} flex="1 1 0px">
                      <PlaygroundOutput playgroundInstanceId={instanceId} />
                    </View>
                  ))}
                </Flex>
              </View>
            </TitledPanel>
          </>
        )}
      </Group>
      {runningExperiment ? (
        <ConfirmExperimentNavigationDialog
          blocker={blocker}
          experimentId={runningExperiment.id}
          isEphemeral={runningExperiment.isEphemeral}
        />
      ) : (
        <ConfirmNavigationDialog
          blocker={blocker}
          message="You have unsaved changes. Are you sure you want to leave?"
        />
      )}
    </Fragment>
  );
}
