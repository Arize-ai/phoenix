import { css } from "@emotion/react";
import { Suspense, useEffect, useRef, useState } from "react";
import type { Key } from "react-aria-components";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  ListBox,
  Loading,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  TextField,
  View,
  Button,
} from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { getDefaultCodeEvaluatorSource } from "@phoenix/components/evaluators/codeEvaluatorDefaults";
import {
  CodeEvaluatorLanguageField,
  CodeEvaluatorSandboxField,
  mapSandboxConfigOptions,
} from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import { CodeEvaluatorSourceEditor } from "@phoenix/components/evaluators/CodeEvaluatorSourceEditor";
import { extractCodeEvaluatorVariables } from "@phoenix/components/evaluators/codeEvaluatorUtils";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { CodeEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/CodeEvaluatorInputVariablesProvider";
import { LLMEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/LLMEvaluatorInputVariablesProvider";
import { TemplateEvaluatorContextProvider } from "@phoenix/components/templateEditor/TemplateEvaluatorContext";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
  EvaluatorStoreProvider,
} from "@phoenix/contexts/EvaluatorContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { PlaygroundChatTemplate } from "@phoenix/pages/playground/PlaygroundChatTemplate";
import {
  PlaygroundInstanceDeleteButton,
  PlaygroundInstanceModelControls,
} from "@phoenix/pages/playground/PlaygroundInstanceControls";
import { TaskMenu } from "@phoenix/pages/playground/TaskMenu";
import type {
  PlaygroundEvaluatorTask,
  PlaygroundEvaluatorTaskCode,
  PlaygroundEvaluatorTaskKind,
} from "@phoenix/store/playground";
import { getPlaygroundEvaluatorTask } from "@phoenix/store/playground";
import { selectPlaygroundInstance } from "@phoenix/store/playground/selectors";
import { extractPathsFromDatasetExamples } from "@phoenix/utils/objectUtils";

import type { EvaluatorTaskEditorQuery } from "./__generated__/EvaluatorTaskEditorQuery.graphql";
import { createEvaluatorTaskAgentHost } from "./evaluatorTaskAgent";
import { useEvaluatorTaskAgentRegistry } from "./EvaluatorTaskAgentContext";
import { EvaluatorTaskMappingSource } from "./EvaluatorTaskMappingSource";
import { EvaluatorTaskOutput } from "./EvaluatorTaskOutput";
import type { EvaluatorTaskSaveApi } from "./EvaluatorTaskSaveButton";
import { EvaluatorTaskSaveButton } from "./EvaluatorTaskSaveButton";
import {
  buildEvaluatorTaskFromStore,
  createEvaluatorTaskStoreState,
  getEvaluatorTaskPreview,
  getEvaluatorTaskRevision,
} from "./evaluatorTaskSnapshot";
import {
  getDefaultSandboxConfigId,
  getEvaluatorTaskValidationError,
} from "./evaluatorTaskValidation";

type SandboxConfigs = ReturnType<typeof mapSandboxConfigOptions>;

/** One example as the template path extractor reads it. */
type PathSample = Parameters<typeof extractPathsFromDatasetExamples>[0][number];

const EMPTY_SANDBOX_CONFIGS: SandboxConfigs = [];

/**
 * Why a draft of the task cannot run or be saved yet, or null. The judge
 * prompt is checked by building its payload from the instance.
 */
function getTaskValidationError({
  evaluator,
  sandboxConfigs,
  playgroundStore,
  instanceId,
  datasetId,
}: {
  evaluator: PlaygroundEvaluatorTask;
  sandboxConfigs: SandboxConfigs;
  playgroundStore: ReturnType<typeof usePlaygroundStore>;
  instanceId: number;
  datasetId: string | null;
}): string | null {
  return getEvaluatorTaskValidationError({
    evaluator,
    sandboxConfigs,
    buildPreview: () =>
      getEvaluatorTaskPreview({
        evaluator,
        name: evaluator.name.trim() || "evaluator",
        playgroundStore,
        instanceId,
        datasetId,
      }),
  });
}

/**
 * The editor for an evaluator task. The shared evaluator components read
 * an evaluator store, so each task mounts its own, seeded from the task on
 * the instance; every change is mirrored back onto the instance, which
 * stays the source for runs, the URL and PXI.
 */
export function EvaluatorTaskEditor({
  instanceId,
  datasetId,
  splitIds,
}: {
  instanceId: number;
  datasetId: string | null;
  splitIds?: string[];
}) {
  const evaluator = usePlaygroundContext((state) =>
    getPlaygroundEvaluatorTask(selectPlaygroundInstance(instanceId)(state))
  );

  if (!evaluator) {
    throw new Error(`Playground instance ${instanceId} is not an evaluator`);
  }

  return (
    <EvaluatorStoreProvider
      initialState={createEvaluatorTaskStoreState(evaluator)}
    >
      {evaluator.kind === "CODE" ? (
        <CodeEvaluatorTaskEditor
          instanceId={instanceId}
          datasetId={datasetId}
          splitIds={splitIds}
        />
      ) : (
        <EvaluatorTaskEditorContent
          instanceId={instanceId}
          datasetId={datasetId}
          splitIds={splitIds}
          kind="LLM"
          sandboxConfigs={EMPTY_SANDBOX_CONFIGS}
        />
      )}
    </EvaluatorStoreProvider>
  );
}

function CodeEvaluatorTaskEditor({
  instanceId,
  datasetId,
  splitIds,
}: {
  instanceId: number;
  datasetId: string | null;
  splitIds?: string[];
}) {
  const data = useLazyLoadQuery<EvaluatorTaskEditorQuery>(
    graphql`
      query EvaluatorTaskEditorQuery {
        sandboxProviders {
          backendType
          supportedLanguages
          enabled
          configs {
            id
            name
            description
            language
            timeout
            config {
              envVars {
                name
                secretKey
              }
              internetAccess {
                mode
              }
              dependencies {
                packages
              }
            }
          }
        }
        sandboxBackends {
          backendType
          status
          supportsEnvVars
          internetAccess
          supportsDependencies
        }
      }
    `,
    {}
  );

  const sandboxConfigs = mapSandboxConfigOptions(
    data.sandboxProviders,
    data.sandboxBackends
  );

  return (
    <EvaluatorTaskEditorContent
      instanceId={instanceId}
      datasetId={datasetId}
      splitIds={splitIds}
      kind="CODE"
      sandboxConfigs={sandboxConfigs}
    />
  );
}

const FALLBACK_CODE: PlaygroundEvaluatorTaskCode = {
  language: "PYTHON",
  sourceCode: "",
  sandboxConfigId: null,
};

function EvaluatorTaskEditorContent({
  instanceId,
  datasetId,
  splitIds,
  kind,
  sandboxConfigs,
}: {
  instanceId: number;
  datasetId: string | null;
  splitIds?: string[];
  kind: PlaygroundEvaluatorTaskKind;
  sandboxConfigs: SandboxConfigs;
}) {
  const playgroundStore = usePlaygroundStore();
  const store = useEvaluatorStoreInstance();

  const evaluator = usePlaygroundContext((state) =>
    getPlaygroundEvaluatorTask(selectPlaygroundInstance(instanceId)(state))
  );

  const index = usePlaygroundContext((state) =>
    state.instances.findIndex((instance) => instance.id === instanceId)
  );

  const hasSiblings = usePlaygroundContext(
    (state) => state.instances.length > 1
  );

  const isDirty = usePlaygroundContext(
    (state) => !!state.dirtyInstances[instanceId]
  );

  if (!evaluator) {
    throw new Error(`Playground instance ${instanceId} is not an evaluator`);
  }

  // The code fields live beside the evaluator store; a fresh draft takes the
  // first sandbox that fits its language so it is runnable without a pick.
  const [code, setCode] = useState<PlaygroundEvaluatorTaskCode>(() => {
    const initial = evaluator.code ?? FALLBACK_CODE;

    return kind === "CODE"
      ? {
          ...initial,
          sandboxConfigId: getDefaultSandboxConfigId({
            sandboxConfigs,
            language: initial.language,
            preferredId: initial.sandboxConfigId,
          }),
        }
      : initial;
  });

  const [selectedTab, setSelectedTab] = useState<Key>("editor");
  const [selectedOutput, setSelectedOutput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // The sandbox the task was loaded with; a save rebinds only on change.
  const [loadedSandboxConfigId, setLoadedSandboxConfigId] = useState(
    evaluator.code?.sandboxConfigId ?? null
  );

  // The mount's mirror only fills in defaults (the sandbox above); it is not
  // an edit, so it leaves the dirty flag alone.
  const isFirstPublish = useRef(true);

  // PXI: the Save button owns the save target and the write, and hands them
  // over once its query resolves; the task's adapter registers only then.
  const registry = useEvaluatorTaskAgentRegistry();
  const [saveApi, setSaveApi] = useState<EvaluatorTaskSaveApi | null>(null);
  // The adapter reads the editor's latest state through this ref, so it is
  // created and registered once instead of on every render.
  const agentState = useRef({ code, sandboxConfigs, datasetId });
  useEffect(() => {
    agentState.current = { code, sandboxConfigs, datasetId };
  });
  useEffect(() => {
    if (!saveApi) {
      return undefined;
    }

    const host = createEvaluatorTaskAgentHost({
      instanceId,
      store,
      playgroundStore,
      getCode: () => (kind === "CODE" ? agentState.current.code : null),
      setCode,
      getSandboxConfigs: () => agentState.current.sandboxConfigs,
      getDatasetId: () => agentState.current.datasetId,
      getValidationError: (task) =>
        getTaskValidationError({
          evaluator: task,
          sandboxConfigs: agentState.current.sandboxConfigs,
          playgroundStore,
          instanceId,
          datasetId: agentState.current.datasetId,
        }),
      getSaveTarget: saveApi.getSaveTarget,
      save: saveApi.save,
    });

    return registry.register(instanceId, host);
  }, [registry, instanceId, kind, store, playgroundStore, saveApi]);

  useEffect(() => {
    function publish() {
      const current = getPlaygroundEvaluatorTask(
        selectPlaygroundInstance(instanceId)(playgroundStore.getState())
      );

      if (!current) {
        return;
      }

      const next = buildEvaluatorTaskFromStore({
        state: store.getState(),
        code: kind === "CODE" ? code : null,
        current,
      });

      setValidationError(
        getTaskValidationError({
          evaluator: next,
          sandboxConfigs,
          playgroundStore,
          instanceId,
          datasetId,
        })
      );

      if (
        getEvaluatorTaskRevision(next) !== getEvaluatorTaskRevision(current)
      ) {
        playgroundStore.getState().updateInstance({
          instanceId,
          patch: { task: { kind: "evaluator", evaluator: next } },
          dirty: isFirstPublish.current ? null : true,
        });
      }

      isFirstPublish.current = false;
    }

    publish();

    const unsubscribeEvaluator = store.subscribe((current, previous) => {
      if (
        current.evaluator !== previous.evaluator ||
        current.outputConfigs !== previous.outputConfigs
      ) {
        publish();
      }
    });

    // The judge prompt is the instance's template and model; its validity
    // changes with them.
    const unsubscribePlayground =
      kind === "LLM"
        ? playgroundStore.subscribe((current, previous) => {
            if (
              current.instances !== previous.instances ||
              current.allInstanceMessages !== previous.allInstanceMessages ||
              current.templateFormat !== previous.templateFormat
            ) {
              publish();
            }
          })
        : undefined;

    return () => {
      unsubscribeEvaluator();
      unsubscribePlayground?.();
    };
  }, [
    store,
    playgroundStore,
    instanceId,
    kind,
    code,
    sandboxConfigs,
    datasetId,
  ]);

  const outputNames = evaluator.outputConfigs.map((config) => config.name);

  const selectedOutputName = outputNames.includes(selectedOutput)
    ? selectedOutput
    : (outputNames[0] ?? "");

  const status = getEvaluatorTaskStatus({ evaluator, isDirty });

  const content = (
    <Flex direction="column" gap="size-100">
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap="size-100"
      >
        <Flex
          direction="row"
          gap="size-100"
          alignItems="center"
          minWidth={0}
          flex="1 1 auto"
          css={css`
            overflow: hidden;
          `}
        >
          <View flex="none">
            <AlphabeticIndexIcon index={index} />
          </View>
          <TaskMenu instanceId={instanceId} />
          <Suspense
            fallback={
              <Button
                size="S"
                isDisabled
                leadingVisual={<Icon svg={<Icons.Save />} />}
              >
                Save
              </Button>
            }
          >
            <EvaluatorTaskSaveButton
              instanceId={instanceId}
              datasetId={datasetId}
              code={code}
              loadedSandboxConfigId={loadedSandboxConfigId}
              validationError={validationError}
              onNameRequired={() => setSelectedTab("output")}
              onSaved={setLoadedSandboxConfigId}
              onSaveApiChange={setSaveApi}
            />
          </Suspense>
          {validationError ? (
            <Flex
              direction="row"
              gap="size-50"
              alignItems="center"
              minWidth={0}
              css={validationCSS}
            >
              <Icon svg={<Icons.AlertTriangle />} />
              <Truncate maxWidth="100%">
                <Text size="S" color="inherit">
                  {validationError}
                </Text>
              </Truncate>
            </Flex>
          ) : status ? (
            <Text size="S" color="text-500">
              {status}
            </Text>
          ) : null}
        </Flex>
        <Flex direction="row" gap="size-100" alignItems="center" flex="none">
          {kind === "LLM" ? (
            <PlaygroundInstanceModelControls
              instanceId={instanceId}
              disableEphemeralRouting
            />
          ) : null}
          {hasSiblings ? (
            <PlaygroundInstanceDeleteButton instanceId={instanceId} />
          ) : null}
        </Flex>
      </Flex>
      {/* Renders nothing; it keeps the mapping sample on the dataset's first
          example, and suspends on its own so the editor stays put. */}
      <Suspense fallback={null}>
        <EvaluatorTaskMappingSource datasetId={datasetId} splitIds={splitIds} />
      </Suspense>
      <Tabs
        css={taskTabsCSS}
        selectedKey={selectedTab}
        onSelectionChange={setSelectedTab}
      >
        <TabList>
          <Tab id="editor">{kind === "CODE" ? "Code" : "Prompt"}</Tab>
          <Tab id="mapping">Input mapping</Tab>
          <Tab id="output">Output</Tab>
        </TabList>
        <TabPanel id="editor" css={taskTabPanelCSS}>
          {kind === "LLM" ? (
            <JudgePromptEditor instanceId={instanceId} />
          ) : (
            <CodeEditor
              code={code}
              onChange={setCode}
              sandboxConfigs={sandboxConfigs}
              // A saved code evaluator keeps its language; only a draft may
              // switch.
              isLanguageLocked={evaluator.source.evaluatorId != null}
            />
          )}
        </TabPanel>
        <TabPanel id="mapping" css={taskTabPanelCSS}>
          <Flex direction="column" gap="size-100">
            <Text color="text-500" size="S">
              Map the evaluator&apos;s variables to fields of the dataset
              example. Variables left blank are matched to fields of the same
              name.
            </Text>
            <View
              borderRadius="medium"
              borderWidth="thin"
              borderColor="default"
              padding="size-200"
            >
              <EvaluatorInputMapping />
            </View>
          </Flex>
        </TabPanel>
        <TabPanel id="output" css={taskTabPanelCSS}>
          <Flex direction="column" gap="size-200">
            <EvaluatorTaskNameField />
            {outputNames.length > 1 ? (
              <Select
                aria-label="Output"
                value={selectedOutputName || null}
                onChange={(key) => {
                  if (key != null) setSelectedOutput(String(key));
                }}
              >
                <Label>Output</Label>
                <Button>
                  <SelectValue />
                  <SelectChevronUpDownIcon />
                </Button>
                <Popover>
                  <ListBox>
                    {outputNames.map((name) => (
                      <SelectItem key={name} id={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </ListBox>
                </Popover>
              </Select>
            ) : null}
            <EvaluatorTaskOutput name={selectedOutputName} />
          </Flex>
        </TabPanel>
      </Tabs>
    </Flex>
  );

  return kind === "LLM" ? (
    <LLMEvaluatorInputVariablesProvider instanceId={instanceId}>
      {content}
    </LLMEvaluatorInputVariablesProvider>
  ) : (
    <CodeEvaluatorInputVariablesProvider
      variables={extractCodeEvaluatorVariables(code)}
    >
      {content}
    </CodeEvaluatorInputVariablesProvider>
  );
}

/** The judge prompt: the instance's own chat template, without prompt tools. */
function JudgePromptEditor({ instanceId }: { instanceId: number }) {
  const source = useEvaluatorStore(
    (state) => state.evaluatorMappingSource.source
  );

  const sample: PathSample = {
    input: source.input,
    taskOutput: source.output,
    metadata: "metadata" in source ? source.metadata : {},
  };

  if ("reference" in source) {
    sample.reference = source.reference;
  }

  const availablePaths = extractPathsFromDatasetExamples([sample], null);

  return (
    <TemplateEvaluatorContextProvider value={null}>
      <Suspense fallback={<Loading size="S" />}>
        <PlaygroundChatTemplate
          playgroundInstanceId={instanceId}
          availablePaths={availablePaths}
          disableTools
          disableNewTool
          disableResponseFormat
        />
      </Suspense>
    </TemplateEvaluatorContextProvider>
  );
}

function CodeEditor({
  code,
  onChange,
  sandboxConfigs,
  isLanguageLocked,
}: {
  code: PlaygroundEvaluatorTaskCode;
  onChange: (code: PlaygroundEvaluatorTaskCode) => void;
  sandboxConfigs: SandboxConfigs;
  isLanguageLocked: boolean;
}) {
  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="row" gap="size-100" alignItems="center">
        <CodeEvaluatorLanguageField
          hideLabel
          isDisabled={isLanguageLocked}
          language={code.language}
          onChange={(language) =>
            onChange({
              language,
              sandboxConfigId: getDefaultSandboxConfigId({
                sandboxConfigs,
                language,
              }),
              sourceCode: getDefaultCodeEvaluatorSource(language, "dataset"),
            })
          }
        />
        <CodeEvaluatorSandboxField
          hideLabel
          sandboxConfigs={sandboxConfigs}
          language={code.language}
          selectedSandboxConfigId={code.sandboxConfigId}
          onSelectionChange={(sandboxConfigId) =>
            onChange({ ...code, sandboxConfigId })
          }
        />
      </Flex>
      <CodeEvaluatorSourceEditor
        hideDescription
        language={code.language}
        sourceCode={code.sourceCode}
        onChange={(sourceCode) => onChange({ ...code, sourceCode })}
      />
    </Flex>
  );
}

function EvaluatorTaskNameField() {
  const globalName = useEvaluatorStore((state) => state.evaluator.globalName);

  const setEvaluatorGlobalName = useEvaluatorStore(
    (state) => state.setEvaluatorGlobalName
  );

  return (
    <TextField
      aria-label="Evaluator name"
      value={globalName}
      onChange={setEvaluatorGlobalName}
    >
      <Label>Name</Label>
      <Input placeholder="e.g. correctness" />
      <Text slot="description">
        Annotations from this evaluator are stored under this name.
      </Text>
    </TextField>
  );
}

/**
 * A clean, never-saved draft says nothing; only a change worth saving, or a
 * successful save, earns a status.
 */
function getEvaluatorTaskStatus({
  evaluator,
  isDirty,
}: {
  evaluator: PlaygroundEvaluatorTask;
  isDirty: boolean;
}): string | null {
  if (isDirty) return "Unsaved changes";

  return evaluator.savedRevision != null ? "Saved" : null;
}

// Warning-toned inline notice; the icon and text share the color.
const validationCSS = css`
  color: var(--global-color-warning);
`;

// The task already sits inside the panel's inset, so the first tab label lines
// up with the task's left edge (the index icon above it) rather than adding the
// tab's own padding on top of that inset.
const taskTabsCSS = css`
  > .react-aria-TabList {
    flex-shrink: 0;
  }

  .react-aria-Tab:first-of-type {
    padding-inline-start: 0;
  }
`;

// The same breathing room below the tab bar as the header has above it.
const taskTabPanelCSS = css`
  padding-top: var(--global-dimension-size-100);
`;
