import { css } from "@emotion/react";
import {
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
import { useShallow } from "zustand/react/shallow";

import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import { createReadExperimentResultsClientAction } from "@phoenix/agent/tools/experimentResults";
import { createSetAppendedMessagesPathClientAction } from "@phoenix/agent/tools/playgroundAppendedMessagesPath";
import {
  createEditEvaluatorTaskClientAction,
  createReadEvaluatorTaskClientAction,
  createSaveEvaluatorTaskClientAction,
} from "@phoenix/agent/tools/playgroundEvaluator";
import { createSetPlaygroundExperimentRecordingClientAction } from "@phoenix/agent/tools/playgroundExperimentRecording";
import { createLoadDatasetClientAction } from "@phoenix/agent/tools/playgroundLoadDataset";
import {
  createListPlaygroundModelTargetsClientAction,
  createSetPlaygroundModelClientAction,
} from "@phoenix/agent/tools/playgroundModel";
import { createReadPlaygroundOutputClientAction } from "@phoenix/agent/tools/playgroundOutput";
import {
  createAddPromptInstanceClientAction,
  createClonePromptInstanceClientAction,
  createEditPromptClientAction,
  createReadPromptClientAction,
  createRemovePromptInstanceClientAction,
} from "@phoenix/agent/tools/playgroundPrompt";
import {
  createReadPromptToolsClientAction,
  createWritePromptToolsClientAction,
} from "@phoenix/agent/tools/playgroundPromptTools";
import { createSetPlaygroundRepetitionsClientAction } from "@phoenix/agent/tools/playgroundRepetitions";
import {
  createCancelPlaygroundRunClientAction,
  createRunPlaygroundClientAction,
  getPlaygroundRunBlocker,
} from "@phoenix/agent/tools/playgroundRun";
import { createSavePromptClientAction } from "@phoenix/agent/tools/playgroundSavePrompt";
import { createSelectTaskClientAction } from "@phoenix/agent/tools/playgroundTask";
import { createSetTemplateVariablesPathClientAction } from "@phoenix/agent/tools/playgroundTemplateVariablesPath";
import { createSetVariableValuesClientAction } from "@phoenix/agent/tools/playgroundVariableValues";
import { registerUIOperations } from "@phoenix/agent/uiOperations/catalog";
import {
  editCodeEvaluatorDraftOperation,
  openCodeEvaluatorFormOperation,
  readCodeEvaluatorDraftOperation,
  testCodeEvaluatorDraftOperation,
} from "@phoenix/agent/uiOperations/operations/codeEvaluatorDraft";
import {
  editLlmEvaluatorDraftOperation,
  openLlmEvaluatorFormOperation,
  readLlmEvaluatorDraftOperation,
  testLlmEvaluatorDraftOperation,
} from "@phoenix/agent/uiOperations/operations/llmEvaluatorDraft";
import {
  editEvaluatorTaskOperation,
  readEvaluatorTaskOperation,
  saveEvaluatorTaskOperation,
} from "@phoenix/agent/uiOperations/operations/playgroundEvaluator";
import { loadDatasetOperation } from "@phoenix/agent/uiOperations/operations/playgroundLoadDataset";
import {
  listPlaygroundModelTargetsOperation,
  setPlaygroundModelOperation,
} from "@phoenix/agent/uiOperations/operations/playgroundModel";
import {
  addPromptInstanceOperation,
  clonePromptInstanceOperation,
  editPromptOperation,
  readPromptOperation,
  removePromptInstanceOperation,
} from "@phoenix/agent/uiOperations/operations/playgroundPrompt";
import {
  readPromptToolsOperation,
  writePromptToolsOperation,
} from "@phoenix/agent/uiOperations/operations/playgroundPromptTools";
import {
  cancelPlaygroundRunOperation,
  readExperimentResultsOperation,
  readPlaygroundOutputOperation,
  runPlaygroundOperation,
} from "@phoenix/agent/uiOperations/operations/playgroundRun";
import { savePromptOperation } from "@phoenix/agent/uiOperations/operations/playgroundSavePrompt";
import {
  setAppendedMessagesPathOperation,
  setPlaygroundExperimentRecordingOperation,
  setPlaygroundRepetitionsOperation,
  setTemplateVariablesPathOperation,
  setVariableValuesOperation,
} from "@phoenix/agent/uiOperations/operations/playgroundSettings";
import { selectTaskOperation } from "@phoenix/agent/uiOperations/operations/playgroundTask";
import { Flex, PageHeader, View } from "@phoenix/components";
import { ConfirmNavigationDialog } from "@phoenix/components/ConfirmNavigation";
import { useModelMenuData } from "@phoenix/components/generative";
import { TitledPanel } from "@phoenix/components/react-resizable-panels";
import { TableSkeleton } from "@phoenix/components/table";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import {
  PlaygroundProvider,
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { describeUnsavedExampleChanges } from "@phoenix/pages/examples/unsavedExampleChanges";
import { ConfirmExperimentNavigationDialog } from "@phoenix/pages/playground/ConfirmExperimentNavigationDialog";
import {
  PlaygroundExampleEditingProvider,
  usePlaygroundExampleEditing,
} from "@phoenix/pages/playground/examplesEditing";
import { PlaygroundExamplePage } from "@phoenix/pages/playground/PlaygroundExamplePage";
import {
  arePlaygroundTaskParamsEqual,
  getPlaygroundTaskParams,
  resolvePlaygroundDatasetId,
  setPlaygroundTaskParams,
} from "@phoenix/pages/playground/playgroundURLSearchParamsUtils";
import type { PlaygroundProps } from "@phoenix/store";
import {
  type AgentClientActionResult,
  waitForRegisteredClientActions,
} from "@phoenix/store/agentStore";
import {
  getEditableTableChangeCount,
  hasEditableTableUnsavedChanges,
} from "@phoenix/store/editableTableStore";
import { getPlaygroundTaskKind } from "@phoenix/store/playground";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type { PlaygroundQuery } from "./__generated__/PlaygroundQuery.graphql";
import {
  createEvaluatorTaskAgentRegistry,
  EvaluatorPlaygroundEmptySource,
  EvaluatorTaskAgentProvider,
} from "./evaluators";
import {
  DecisionRequestActions,
  DecisionRequestEditor,
} from "./DecisionRequestEditor";
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
import { PlaygroundDecisionComparison } from "./PlaygroundDecisionComparison";
import { PlaygroundDecisionOutput } from "./PlaygroundDecisionOutput";
import { PlaygroundInput } from "./PlaygroundInput";
import { PlaygroundOutput } from "./PlaygroundOutput";
import {
  getPlaygroundPanelIds,
  PLAYGROUND_PANEL_LAYOUT_ID,
} from "./playgroundPanelLayout";
import { PlaygroundRunButton } from "./PlaygroundRunButton";
import { PlaygroundTaskInstance } from "./PlaygroundTaskInstance";
import { PlaygroundCompareMenu } from "./TaskMenu";
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

  const { modelProviders, decisionModels } = useLazyLoadQuery<PlaygroundQuery>(
    graphql`
      query PlaygroundQuery {
        modelProviders {
          name
          dependenciesInstalled
          dependencies
        }
        decisionModels: playgroundModels(
          input: { providerKey: null, modelType: DECISION }
        ) {
          name
          providerKey
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
  const isDecisionMode =
    searchParams.get("modelType") === "DECISION" && !datasetId;
  // Resolve the decision default from the server catalog so new decision
  // providers and models need no frontend change. URL params win when they
  // name a cataloged provider; otherwise fall back to the first entry.
  const requestedDecisionProvider = searchParams.get("decisionProvider");
  const requestedDecisionModel = searchParams.get("decisionModel");
  const decisionDefault =
    decisionModels.find(
      (model) =>
        model.providerKey === requestedDecisionProvider &&
        (requestedDecisionModel == null ||
          model.name === requestedDecisionModel)
    ) ??
    decisionModels.find(
      (model) => model.providerKey === requestedDecisionProvider
    ) ??
    decisionModels[0] ??
    null;
  const decisionProvider: ModelProvider =
    decisionDefault && isModelProvider(decisionDefault.providerKey)
      ? decisionDefault.providerKey
      : "OPENAI";
  const decisionModelName =
    requestedDecisionProvider === decisionProvider && requestedDecisionModel
      ? requestedDecisionModel
      : decisionDefault?.name;

  if (!hasInstalledProvider) {
    return <NoInstalledProvider availableProviders={modelProviders} />;
  }
  return (
    <PlaygroundProvider
      {...props}
      datasetId={datasetId}
      streaming={playgroundStreamingEnabled}
      modelConfigByProvider={modelConfigByProvider}
      defaultModelType={isDecisionMode ? "DECISION" : "LLM"}
      defaultModelProvider={
        isDecisionMode ? decisionProvider : defaultModelProvider
      }
      defaultModelName={isDecisionMode ? decisionModelName : defaultModelName}
    >
      <PlaygroundExampleEditingProvider>
        <div css={playgroundWrapCSS}>
          {/* The panels below shrink, not the header, so the header controls
              stay put whatever kind of task the page holds. */}
          <View
            borderBottomColor="default"
            borderBottomWidth="thin"
            flex="none"
          >
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
      </PlaygroundExampleEditingProvider>
      <Suspense>
        <PlaygroundExamplePage />
      </Suspense>
    </PlaygroundProvider>
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
  // eslint-disable-next-line react/refs
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

  const taskKind = usePlaygroundContext((state) =>
    getPlaygroundTaskKind(state.instances)
  );

  const hasDecisionInstance = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.model.modelType === "DECISION")
  );
  const hasLLMInstance = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.model.modelType !== "DECISION")
  );
  const decisionInstances = usePlaygroundContext(
    useShallow((state) =>
      state.instances.filter(
        (instance) => instance.model.modelType === "DECISION"
      )
    )
  );
  const decisionInstanceIds = decisionInstances.map((instance) => instance.id);
  // When every instance is a decision model, output is one comparison grid
  // (same question across models) instead of one card per instance.
  const showDecisionComparison = hasDecisionInstance && !hasLLMInstance;
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

  const anyDirtyInstances = usePlaygroundContext((state) =>
    Object.values(state.dirtyInstances).some((dirty) => dirty)
  );
  // Edits to the dataset's examples the table has not saved. They are read
  // here because a router honors one blocker, and this is it.
  const unsavedExampleChangeCount = usePlaygroundExampleEditing((session) =>
    hasEditableTableUnsavedChanges(session)
      ? getEditableTableChangeCount(session)
      : 0
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
      state.instances.map((instance, index) =>
        getPlaygroundInstanceForAgent(instance, {
          index,
          isDirty: state.dirtyInstances[instance.id] === true,
        })
      ),
    arePlaygroundInstancesForAgentEqual
  );

  // The PXI adapters of the mounted evaluator task editors, by instance id.
  const [evaluatorTaskAgents] = useState(createEvaluatorTaskAgentRegistry);

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
        taskKind,
        recordExperiments,
        repetitions,
        nextExperimentScaffold: experimentScaffoldForAgent,
        instances: playgroundInstancesForAgent,
      }),
    [
      taskKind,
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
      setPendingPromptEdit,
      setPendingPromptInstanceRemoval,
      setPendingSavePrompt,
      setPendingLoadDataset,
      setPendingPromptToolWrite,
    } = agentStore.getState();

    const waitForEvaluatorHost = evaluatorTaskAgents.waitFor;
    const evaluatorTaskActionDeps = { playgroundStore, waitForEvaluatorHost };

    const unregister = registerUIOperations({
      agentStore,
      operations: [
        {
          descriptor: selectTaskOperation,
          handler: createSelectTaskClientAction(evaluatorTaskActionDeps),
        },
        {
          descriptor: readPromptOperation,
          handler: createReadPromptClientAction({ playgroundStore }),
        },
        {
          descriptor: clonePromptInstanceOperation,
          handler: createClonePromptInstanceClientAction({ playgroundStore }),
        },
        {
          descriptor: addPromptInstanceOperation,
          handler: createAddPromptInstanceClientAction(evaluatorTaskActionDeps),
        },
        {
          descriptor: readEvaluatorTaskOperation,
          handler: createReadEvaluatorTaskClientAction(evaluatorTaskActionDeps),
        },
        {
          descriptor: editEvaluatorTaskOperation,
          handler: createEditEvaluatorTaskClientAction(evaluatorTaskActionDeps),
        },
        {
          descriptor: saveEvaluatorTaskOperation,
          handler: createSaveEvaluatorTaskClientAction(evaluatorTaskActionDeps),
        },
        {
          descriptor: removePromptInstanceOperation,
          handler: createRemovePromptInstanceClientAction({
            playgroundStore,
            setPendingPromptInstanceRemoval,
            shouldAutoAccept: () =>
              agentStore.getState().permissions.edits === "bypass",
          }),
        },
        {
          descriptor: editPromptOperation,
          handler: createEditPromptClientAction({
            playgroundStore,
            setPendingPromptEdit,
            shouldAutoAccept: () =>
              agentStore.getState().permissions.edits === "bypass",
          }),
        },
        {
          descriptor: savePromptOperation,
          handler: createSavePromptClientAction({
            playgroundStore,
            setPendingSavePrompt,
            shouldAutoAccept: () =>
              agentStore.getState().permissions.edits === "bypass",
          }),
        },
        {
          descriptor: runPlaygroundOperation,
          handler: createRunPlaygroundClientAction({
            playgroundStore,
            // Evaluator tasks need the page's dataset and a valid editor.
            getRunBlocker: () =>
              getPlaygroundRunBlocker({
                instances: playgroundStore.getState().instances,
                datasetId: resolvePlaygroundDatasetId({
                  searchParams: searchParamsRef.current,
                  storeDatasetId: playgroundStore.getState().datasetId,
                }),
                getEvaluatorHost: evaluatorTaskAgents.get,
              }),
          }),
        },
        {
          descriptor: readPlaygroundOutputOperation,
          handler: createReadPlaygroundOutputClientAction({ playgroundStore }),
        },
        {
          descriptor: readExperimentResultsOperation,
          handler: createReadExperimentResultsClientAction(),
        },
        {
          descriptor: setVariableValuesOperation,
          handler: createSetVariableValuesClientAction({ playgroundStore }),
        },
        {
          descriptor: setPlaygroundExperimentRecordingOperation,
          handler: createSetPlaygroundExperimentRecordingClientAction({
            playgroundStore,
          }),
        },
        {
          descriptor: setPlaygroundRepetitionsOperation,
          handler: createSetPlaygroundRepetitionsClientAction({
            playgroundStore,
          }),
        },
        {
          descriptor: setTemplateVariablesPathOperation,
          handler: createSetTemplateVariablesPathClientAction({
            playgroundStore,
            getSearchParams: () => searchParamsRef.current,
          }),
        },
        {
          descriptor: loadDatasetOperation,
          handler: createLoadDatasetClientAction({
            playgroundStore,
            setSearchParams,
            getSearchParams: () => searchParamsRef.current,
            setPendingLoadDataset,
            shouldAutoAccept: () =>
              agentStore.getState().permissions.edits === "bypass",
          }),
        },
        {
          descriptor: readPromptToolsOperation,
          handler: createReadPromptToolsClientAction({ playgroundStore }),
        },
        {
          descriptor: writePromptToolsOperation,
          handler: createWritePromptToolsClientAction({
            playgroundStore,
            setPendingPromptToolWrite,
            shouldAutoAccept: () =>
              agentStore.getState().permissions.edits === "bypass",
          }),
        },
        {
          descriptor: setAppendedMessagesPathOperation,
          handler: createSetAppendedMessagesPathClientAction({
            playgroundStore,
            getSearchParams: () => searchParamsRef.current,
          }),
        },
      ],
    });
    return () => {
      unregister();
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
  }, [agentStore, evaluatorTaskAgents, playgroundStore, setSearchParams]);

  useEffect(
    () =>
      registerUIOperations({
        agentStore,
        operations: [
          {
            descriptor: cancelPlaygroundRunOperation,
            handler: createCancelPlaygroundRunClientAction({
              playgroundStore,
              cancelRun: cancelPlaygroundRun,
            }),
          },
        ],
      }),
    [agentStore, cancelPlaygroundRun, playgroundStore]
  );

  useEffect(
    () =>
      registerUIOperations({
        agentStore,
        operations: [
          {
            descriptor: listPlaygroundModelTargetsOperation,
            handler: createListPlaygroundModelTargetsClientAction({
              availableBuiltinModels,
              availableCustomModels,
            }),
          },
          {
            descriptor: setPlaygroundModelOperation,
            handler: createSetPlaygroundModelClientAction({
              playgroundStore,
              modelCatalog,
              modelConfigByProvider,
              awsBedrockModelPrefix,
            }),
          },
        ],
      }),
    [
      agentStore,
      availableBuiltinModels,
      availableCustomModels,
      awsBedrockModelPrefix,
      modelCatalog,
      modelConfigByProvider,
      playgroundStore,
    ]
  );

  useEffect(() => {
    if (!datasetId) {
      return undefined;
    }
    return registerUIOperations({
      agentStore,
      operations: [
        {
          descriptor: openCodeEvaluatorFormOperation,
          handler: async (): Promise<AgentClientActionResult> => {
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
                readCodeEvaluatorDraftOperation.name,
                editCodeEvaluatorDraftOperation.name,
                testCodeEvaluatorDraftOperation.name,
              ],
            });
            if (!isReady) {
              return {
                ok: false,
                error:
                  "The code-evaluator form opened, but its draft operations did not finish loading. Try opening the form again before reading the draft.",
              };
            }
            return {
              ok: true,
              output:
                "Code-evaluator form opened for the current playground dataset; draft operations are ready.",
            };
          },
        },
        {
          descriptor: openLlmEvaluatorFormOperation,
          handler: async (): Promise<AgentClientActionResult> => {
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
                readLlmEvaluatorDraftOperation.name,
                editLlmEvaluatorDraftOperation.name,
                testLlmEvaluatorDraftOperation.name,
              ],
            });
            if (!isReady) {
              return {
                ok: false,
                error:
                  "The LLM-evaluator form opened, but its draft operations did not finish loading. Try opening the form again before reading the draft.",
              };
            }
            return {
              ok: true,
              output:
                "LLM-evaluator form opened for the current playground dataset; draft operations are ready.",
            };
          },
        },
      ],
    });
  }, [agentStore, datasetId, isRunning]);

  const playgroundDatasetStateByDatasetId = usePlaygroundContext(
    (state) => state.stateByDatasetId
  );
  const playgroundDatasetState = datasetId
    ? playgroundDatasetStateByDatasetId[datasetId]
    : null;
  const { appendedMessagesPath, availablePaths } = playgroundDatasetState ?? {};

  // Derive the task params from all instances for URL sync.
  // Only re-render when the params actually change.
  const taskParams = usePlaygroundContext(
    (state) => getPlaygroundTaskParams(state.instances),
    arePlaygroundTaskParamsEqual
  );

  // Sync task state from the store to URL search params.
  // Uses replace to avoid polluting browser history.
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        setPlaygroundTaskParams({ searchParams: next, tasks: taskParams });

        return next;
      },
      { replace: true }
    );
  }, [taskParams, setSearchParams]);

  // Soft block at the router level:
  // - Ephemeral experiment running: will stop on disconnect, user must stay or accept
  // - Non-ephemeral experiment running: daemon continues, but ask if user wants to stop
  // - Dirty prompts: unsaved changes warning
  // - Unsaved edits to the dataset's examples: they live only in memory
  const hasUnsavedExampleChanges = unsavedExampleChangeCount > 0;
  const shouldBlockUnload = useCallback(
    ({ currentLocation, nextLocation }: Parameters<BlockerFunction>[0]) => {
      const goingToNewPage = currentLocation.pathname !== nextLocation.pathname;

      return (
        (isRunning || anyDirtyInstances || hasUnsavedExampleChanges) &&
        goingToNewPage
      );
    },
    [isRunning, anyDirtyInstances, hasUnsavedExampleChanges]
  );
  const blocker = useBlocker(shouldBlockUnload);

  // Hard block at the browser level when an experiment is running or example
  // edits are unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = true;
    };

    if (isRunning || hasUnsavedExampleChanges) {
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }
    return undefined;
  }, [isRunning, hasUnsavedExampleChanges]);

  const panelIds = useMemo(
    () => getPlaygroundPanelIds({ isDatasetMode, templateFormat, taskKind }),
    [isDatasetMode, templateFormat, taskKind]
  );
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: PLAYGROUND_PANEL_LAYOUT_ID,
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
    <EvaluatorTaskAgentProvider registry={evaluatorTaskAgents}>
      <Group
        orientation="vertical"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        style={{ flex: 1, minHeight: 0 }}
      >
        <TitledPanel
          ref={promptsPanelRef}
          headingLevel={2}
          title={taskKind === "evaluator" ? "Evaluators" : hasDecisionInstance ? "Models & input" : "Prompts"}
          extra={
            <Flex direction="row" gap="size-100" alignItems="center">
              {taskKind === "prompt" ? (
                <TemplateFormatRadioGroup size="S" />
              ) : null}
              <PlaygroundCompareMenu />
            </Flex>
          }
          panelProps={{
            id: "prompts",
            minSize: "15%",
            // The request editor is the work surface in decision mode, so it
            // opens taller the first time; a saved layout still wins.
            defaultSize: hasDecisionInstance ? "55%" : undefined,
          }}
          onCollapseChange={(collapsed) =>
            handleSectionCollapse(collapsed, "prompts")
          }
        >
          <div css={promptsWrapCSS}>
            <Flex
              direction="row"
              // Decision headers sit side by side, so a wider gap keeps each
              // model's controls reading as one group.
              gap={hasDecisionInstance ? "size-400" : "size-200"}
              maxWidth="100%"
              // Decision columns hold only a model header, so let them wrap
              // rather than forcing a horizontal scroll to reach instance B.
              wrap={hasDecisionInstance}
            >
              {instanceIds.map((instanceId) => (
                <View
                  // A decision column is only its model header, so it takes
                  // the width of that header and sits beside the next one.
                  flex={
                    decisionInstanceIds.includes(instanceId)
                      ? "none"
                      : "1 1 0px"
                  }
                  key={`${instanceId}-task`}
                  minWidth={
                    hasDecisionInstance
                      ? undefined
                      : PLAYGROUND_PROMPT_PANEL_MIN_WIDTH
                  }
                >
                  <PlaygroundTaskInstance
                    instanceId={instanceId}
                    datasetId={datasetId}
                    splitIds={splitIds}
                    appendedMessagesPath={appendedMessagesPath}
                    availablePaths={availablePaths}
                    supportsDecisionModels={!isDatasetMode}
                  />
                </View>
              ))}
              {hasDecisionInstance ? (
                <View flex="none" marginStart="auto">
                  <DecisionRequestActions />
                </View>
              ) : null}
            </Flex>
            {hasDecisionInstance ? <DecisionRequestEditor /> : null}
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
                <TableSkeleton rowCount="fill" />
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
        ) : taskKind === "evaluator" ? (
          <TitledPanel
            ref={ioPanelRef}
            headingLevel={2}
            resizable
            title="Experiment"
            extra={<PlaygroundDatasetSelect />}
            panelProps={IO_PANEL_PROPS}
            onCollapseChange={(collapsed) =>
              handleSectionCollapse(collapsed, "io")
            }
          >
            <EvaluatorPlaygroundEmptySource />
          </TitledPanel>
        ) : (
          <>
            {templateFormat !== TemplateFormats.NONE ? (
              <TitledPanel
                ref={inputsPanelRef}
                headingLevel={2}
                resizable
                title="Inputs"
                extra={
                  <PlaygroundDatasetSelect isDisabled={hasDecisionInstance} />
                }
                panelProps={{
                  id: "input",
                  minSize: "10%",
                  defaultSize: hasDecisionInstance ? "15%" : undefined,
                }}
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
                {showDecisionComparison ? (
                  <PlaygroundDecisionComparison instances={decisionInstances} />
                ) : (
                  <Flex direction="row" gap="size-200">
                    {instanceIds.map((instanceId) => (
                      <View key={`${instanceId}-output`} flex="1 1 0px">
                        {decisionInstanceIds.includes(instanceId) ? (
                          <PlaygroundDecisionOutput
                            playgroundInstanceId={instanceId}
                          />
                        ) : (
                          <PlaygroundOutput playgroundInstanceId={instanceId} />
                        )}
                      </View>
                    ))}
                  </Flex>
                )}
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
          message={
            hasUnsavedExampleChanges
              ? `Leaving this page will discard ${describeUnsavedExampleChanges(
                  { count: unsavedExampleChangeCount }
                )}.`
              : "You have unsaved changes. Are you sure you want to leave?"
          }
        />
      )}
    </EvaluatorTaskAgentProvider>
  );
}
