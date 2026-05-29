import { css } from "@emotion/react";
import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import type { BlockerFunction } from "react-router";
import { useBlocker, useSearchParams } from "react-router";

import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import { OPEN_CODE_EVALUATOR_FORM_TOOL_NAME } from "@phoenix/agent/extensions/toolRegistry";
import {
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  TEST_CODE_EVALUATOR_DRAFT_TOOL_NAME,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import {
  createSetPlaygroundModelClientAction,
  SET_PLAYGROUND_MODEL_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundModel";
import {
  createReadPlaygroundOutputClientAction,
  READ_PLAYGROUND_OUTPUT_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundOutput";
import {
  CLONE_PROMPT_INSTANCE_TOOL_NAME,
  createClonePromptInstanceClientAction,
  createEditPromptClientAction,
  createReadPromptClientAction,
  EDIT_PROMPT_TOOL_NAME,
  READ_PROMPT_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPrompt";
import {
  createReadPromptToolsClientAction,
  createWritePromptToolsClientAction,
  READ_PROMPT_TOOLS_TOOL_NAME,
  WRITE_PROMPT_TOOLS_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPromptTools";
import {
  createRunPlaygroundClientAction,
  RUN_PLAYGROUND_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundRun";
import {
  createSavePromptClientAction,
  SAVE_PROMPT_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundSavePrompt";
import {
  createSetVariableValuesClientAction,
  SET_VARIABLE_VALUES_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundVariableValues";
import {
  Button,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  PageHeader,
  View,
} from "@phoenix/components";
import { ConfirmNavigationDialog } from "@phoenix/components/ConfirmNavigation";
import { useModelMenuData } from "@phoenix/components/generative";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { StopPropagation } from "@phoenix/components/StopPropagation";
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
import { setPromptParams } from "@phoenix/pages/playground/playgroundURLSearchParamsUtils";
import type { PlaygroundProps } from "@phoenix/store";
import {
  type AgentClientActionResult,
  waitForRegisteredClientActions,
} from "@phoenix/store/agentStore";

import type { PlaygroundQuery } from "./__generated__/PlaygroundQuery.graphql";
import { NUM_MAX_PLAYGROUND_INSTANCES } from "./constants";
import { NoInstalledProvider } from "./NoInstalledProvider";
import { PlaygroundConfigButton } from "./PlaygroundConfigButton";
import { PlaygroundCredentialsDropdown } from "./PlaygroundCredentialsDropdown";
import { PlaygroundDatasetSection } from "./PlaygroundDatasetSection";
import { PlaygroundDatasetSelect } from "./PlaygroundDatasetSelect";
import { PlaygroundInput } from "./PlaygroundInput";
import { PlaygroundOutput } from "./PlaygroundOutput";
import { PlaygroundRunButton } from "./PlaygroundRunButton";
import { PlaygroundTemplate } from "./PlaygroundTemplate";
import { TemplateFormatRadioGroup } from "./TemplateFormatRadioGroup";

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
  const experimentId = searchParams.get("experimentId");
  const datasetId = experimentId
    ? (props.datasetId ?? null)
    : searchParams.get("datasetId");

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
      leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
      isDisabled={numInstances >= NUM_MAX_PLAYGROUND_INSTANCES || isRunning}
      onPress={() => {
        addInstance();
      }}
    >
      Compare
    </Button>
  );
}

const playgroundPromptPanelContentCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  & > .disclosure-group {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    flex: 1 1 auto;
    & > .disclosure {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      overflow-y: hidden;
      flex: 1 1 auto;
      // prevent the accordion item header from growing to fill the accordion item
      // using two selectors as fallback just incase the component lib changes subtly
      & > [role="button"],
      & > #prompts-heading {
        flex: 0 0 auto;
      }
      .disclosure__panel {
        height: 100%;
        overflow: hidden;
        flex: 1 1 auto;
      }
    }
  }
`;

const promptsWrapCSS = css`
  padding: var(--global-dimension-size-200);
  scrollbar-gutter: stable;
  height: 100%;
  flex: 1 1 auto;
  overflow: auto;
  box-sizing: border-box;
`;

const playgroundInputOutputPanelContentCSS = css`
  height: 100%;
  overflow: auto;
`;

/**
 * This width accomodates the model config button min-width, as well as chat message accordion
 * header contents such as the chat message mode radio group for AI messages
 */
const PLAYGROUND_PROMPT_PANEL_MIN_WIDTH = 632;

const DEFAULT_EXPANDED_PROMPTS = ["prompts"];
const DEFAULT_EXPANDED_PARAMS = ["input", "output"];

function PlaygroundContent() {
  const agentStore = useAgentStore();
  const playgroundStore = usePlaygroundStore();
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const [searchParams, setSearchParams] = useSearchParams();
  const storeDatasetId = usePlaygroundContext((state) => state.datasetId);
  const experimentId = searchParams.get("experimentId");
  const datasetId = experimentId
    ? storeDatasetId
    : searchParams.get("datasetId");
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
  const playgroundInstancesForAgent = usePlaygroundContext(
    (state) =>
      state.instances.map((instance) => ({
        instanceId: instance.id,
        provider: instance.model.provider,
        modelName: instance.model.modelName,
        customProviderId: instance.model.customProvider?.id ?? null,
        customProviderName: instance.model.customProvider?.name ?? null,
      })),
    (left, right) =>
      left.length === right.length &&
      left.every((leftInstance, index) => {
        const rightInstance = right[index];
        return (
          rightInstance != null &&
          leftInstance.instanceId === rightInstance.instanceId &&
          leftInstance.provider === rightInstance.provider &&
          leftInstance.modelName === rightInstance.modelName &&
          leftInstance.customProviderId === rightInstance.customProviderId &&
          leftInstance.customProviderName === rightInstance.customProviderName
        );
      })
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
    () => ({
      type: "playground" as const,
      instances: playgroundInstancesForAgent,
      availableBuiltinModels,
      availableCustomModels,
    }),
    [availableBuiltinModels, availableCustomModels, playgroundInstancesForAgent]
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
      setPendingSavePrompt,
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
    return () => {
      unregisterClientAction(READ_PROMPT_TOOL_NAME);
      unregisterClientAction(CLONE_PROMPT_INSTANCE_TOOL_NAME);
      unregisterClientAction(EDIT_PROMPT_TOOL_NAME);
      unregisterClientAction(SAVE_PROMPT_TOOL_NAME);
      unregisterClientAction(RUN_PLAYGROUND_TOOL_NAME);
      unregisterClientAction(READ_PLAYGROUND_OUTPUT_TOOL_NAME);
      unregisterClientAction(SET_VARIABLE_VALUES_TOOL_NAME);
      for (const pendingEdit of Object.values(
        agentStore.getState().pendingPromptEditsByToolCallId
      )) {
        if (pendingEdit) {
          void pendingEdit.cancel?.();
        }
      }
      for (const pendingSave of Object.values(
        agentStore.getState().pendingSavePromptsByToolCallId
      )) {
        if (pendingSave) {
          void pendingSave.cancel?.();
        }
      }
    };
  }, [agentStore, playgroundStore]);

  useEffect(() => {
    const { registerClientAction, unregisterClientAction } =
      agentStore.getState();
    registerClientAction(
      READ_PROMPT_TOOLS_TOOL_NAME,
      createReadPromptToolsClientAction({ playgroundStore })
    );
    registerClientAction(
      WRITE_PROMPT_TOOLS_TOOL_NAME,
      createWritePromptToolsClientAction({ playgroundStore })
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
      unregisterClientAction(READ_PROMPT_TOOLS_TOOL_NAME);
      unregisterClientAction(WRITE_PROMPT_TOOLS_TOOL_NAME);
      unregisterClientAction(SET_PLAYGROUND_MODEL_TOOL_NAME);
    };
  }, [
    agentStore,
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
    return () => {
      unregisterClientAction(OPEN_CODE_EVALUATOR_FORM_TOOL_NAME);
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

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "playground-panels",
    storage: localStorage,
  });

  return (
    <Fragment key="playground-content">
      <Group
        orientation="vertical"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <Panel id="prompts">
          <div css={playgroundPromptPanelContentCSS}>
            <DisclosureGroup defaultExpandedKeys={DEFAULT_EXPANDED_PROMPTS}>
              <Disclosure id="prompts" size="L">
                <DisclosureTrigger
                  arrowPosition="start"
                  justifyContent="space-between"
                >
                  Prompts
                  <StopPropagation>
                    <Flex direction="row" gap="size-100" alignItems="center">
                      <TemplateFormatRadioGroup size="S" />
                      <AddPromptButton />
                    </Flex>
                  </StopPropagation>
                </DisclosureTrigger>
                <DisclosurePanel>
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
                </DisclosurePanel>
              </Disclosure>
            </DisclosureGroup>
          </div>
        </Panel>
        <Separator css={compactResizeHandleCSS} />
        <Panel id="io">
          {isDatasetMode ? (
            <Suspense fallback={<Loading />}>
              <PlaygroundDatasetSection
                key={datasetId} // reset evaluator selection when dataset changes
                datasetId={datasetId}
                splitIds={splitIds}
                isCodeEvaluatorFormOpen={isCodeEvaluatorFormOpen}
                onCodeEvaluatorFormOpenChange={(isOpen) =>
                  setCodeEvaluatorFormDatasetId(isOpen ? datasetId : null)
                }
              />
            </Suspense>
          ) : (
            <div css={playgroundInputOutputPanelContentCSS}>
              <DisclosureGroup defaultExpandedKeys={DEFAULT_EXPANDED_PARAMS}>
                {templateFormat !== TemplateFormats.NONE ? (
                  <Disclosure id="input" size="L">
                    <DisclosureTrigger arrowPosition="start">
                      <Flex
                        direction="row"
                        gap="size-100"
                        alignItems="center"
                        justifyContent="space-between"
                        width="100%"
                      >
                        Inputs
                        <PlaygroundDatasetSelect />
                      </Flex>
                    </DisclosureTrigger>
                    <DisclosurePanel>
                      <View padding="size-200" height={"100%"}>
                        <PlaygroundInput />
                      </View>
                    </DisclosurePanel>
                  </Disclosure>
                ) : null}
                <Disclosure id="output" size="L">
                  <DisclosureTrigger arrowPosition="start">
                    Output
                  </DisclosureTrigger>
                  <DisclosurePanel>
                    <View padding="size-200" height="100%">
                      <Flex direction="row" gap="size-200">
                        {instanceIds.map((instanceId) => (
                          <View key={`${instanceId}-output`} flex="1 1 0px">
                            <PlaygroundOutput
                              playgroundInstanceId={instanceId}
                            />
                          </View>
                        ))}
                      </Flex>
                    </View>
                  </DisclosurePanel>
                </Disclosure>
              </DisclosureGroup>
            </div>
          )}
        </Panel>
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
