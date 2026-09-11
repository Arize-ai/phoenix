import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useContext, useEffect, useEffectEvent, useRef, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useSearchParams } from "react-router";

import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import {
  Alert,
  Button,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  ListBox,
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
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import {
  CodeEvaluatorLanguageField,
  CodeEvaluatorSandboxField,
  mapSandboxConfigOptions,
} from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import { CodeEvaluatorSourceEditor } from "@phoenix/components/evaluators/CodeEvaluatorSourceEditor";
import {
  extractCodeEvaluatorVariables,
  getDefaultCodeEvaluatorSource,
} from "@phoenix/components/evaluators/codeEvaluatorUtils";
import { EvaluatorChatTemplate } from "@phoenix/components/evaluators/EvaluatorChatTemplate";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { CodeEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/CodeEvaluatorInputVariablesProvider";
import { LLMEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/LLMEvaluatorInputVariablesProvider";
import {
  buildOutputConfigsInput,
  createLLMEvaluatorPayload,
  getEvaluatorOutputConfigValidationErrors,
} from "@phoenix/components/evaluators/utils";
import {
  useModelMenuData,
  type ModelCatalog,
} from "@phoenix/components/generative";
import { usePreferencesContext } from "@phoenix/contexts";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { PlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import type { PlaygroundInstancePrompt } from "@phoenix/store";
import type { PlaygroundStore } from "@phoenix/store/playground";
import type { CodeEvaluatorLanguage } from "@phoenix/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { EvaluatorSlotEditorQuery } from "./__generated__/EvaluatorSlotEditorQuery.graphql";
import { createEvaluatorAgentSlot } from "./evaluatorAgentSlot";
import type { EvaluatorSaveTarget } from "./evaluatorSaveTarget";
import { EvaluatorSlotOutput } from "./EvaluatorSlotOutput";
import type {
  EvaluatorSlotProps,
  SlotOutput,
  SlotSnapshot,
} from "./evaluatorSlotTypes";
import {
  getCodeSlotValidationError,
  getDefaultSandboxConfigId,
} from "./evaluatorSlotValidation";
import {
  SAVE_EFFECTS,
  SaveEvaluatorSlotDialog,
} from "./SaveEvaluatorSlotDialog";
import { useEvaluatorSlotSave } from "./useEvaluatorSlotSave";

type EditorProps = EvaluatorSlotProps & {
  kind: "LLM" | "CODE";
  saveTarget: EvaluatorSaveTarget;
  sourceControl: ReactNode;
  initialLanguage?: CodeEvaluatorLanguage;
  initialSourceCode?: string;
  initialSandboxConfigId?: string;
};

const EMPTY_SANDBOX_CONFIGS: ReturnType<typeof mapSandboxConfigOptions> = [];

const EMPTY_MODEL_CATALOG: ModelCatalog = {
  installedBuiltInProviders: new Set(),
  customProviders: [],
};

export function EvaluatorSlotEditor(props: EditorProps) {
  return props.kind === "CODE" ? (
    <CodeSlotEditor {...props} />
  ) : (
    <LLMSlotEditor {...props} />
  );
}

function CodeSlotEditor(props: EditorProps) {
  const data = useLazyLoadQuery<EvaluatorSlotEditorQuery>(
    graphql`
      query EvaluatorSlotEditorQuery {
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
    <EvaluatorSlotEditorContent
      {...props}
      sandboxConfigs={sandboxConfigs}
      modelCatalog={EMPTY_MODEL_CATALOG}
    />
  );
}

function LLMSlotEditor(props: EditorProps) {
  const { modelCatalog } = useModelMenuData({
    fetchPolicy: "store-or-network",
  });

  return (
    <EvaluatorSlotEditorContent
      {...props}
      sandboxConfigs={EMPTY_SANDBOX_CONFIGS}
      modelCatalog={modelCatalog}
    />
  );
}

function EvaluatorSlotEditorContent({
  kind,
  saveTarget,
  initialLanguage,
  initialSourceCode,
  initialSandboxConfigId,
  sourceControl,
  sandboxConfigs,
  modelCatalog,
  ...props
}: EditorProps & {
  sandboxConfigs: ReturnType<typeof mapSandboxConfigOptions>;
  modelCatalog: ModelCatalog;
}) {
  const {
    datasetId,
    slotId,
    onChange,
    onRemove,
    isRunning,
    sampleContext,
    registerAgentSlot,
    initialDatasetEvaluatorId,
    initialEvaluatorId,
  } = props;

  const [searchParams, setSearchParams] = useSearchParams();
  const tabKey = `slotTab${slotId}`;
  const selectedTab = searchParams.get(tabKey) ?? "editor";
  const store = useEvaluatorStoreInstance();
  const globalName = useEvaluatorStore((state) => state.evaluator.globalName);

  const setEvaluatorGlobalName = useEvaluatorStore(
    (state) => state.setEvaluatorGlobalName
  );

  const playgroundStore = useContext(PlaygroundContext);

  const [language, setLanguage] = useState<CodeEvaluatorLanguage>(
    initialLanguage ?? "PYTHON"
  );

  const [sourceCode, setSourceCode] = useState(
    initialSourceCode ?? getDefaultCodeEvaluatorSource(language, "dataset")
  );

  const [sandboxConfigId, setSandboxConfigId] = useState<string | null>(() =>
    getDefaultSandboxConfigId({
      sandboxConfigs,
      language,
      preferredId: initialSandboxConfigId,
    })
  );

  const [selectedOutput, setSelectedOutput] = useState("");
  const [snapshot, setSnapshot] = useState<SlotSnapshot | null>(null);
  const initialRevision = useRef<string | null>(null);
  const [savedRevision, setSavedRevision] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { save: saveSlot, copyName, isSaving } = useEvaluatorSlotSave();
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  // A parent render must not rebuild the evaluator or restart subscriptions.
  const onSnapshotChange = useEffectEvent(onChange);
  useEffect(() => {
    store.getState().setEvaluatorMappingSource({
      grain: "dataset",
      source: {
        input: isStringKeyedObject(sampleContext.input)
          ? sampleContext.input
          : { value: sampleContext.input },
        output: isStringKeyedObject(sampleContext.output)
          ? sampleContext.output
          : { value: sampleContext.output },
        reference: isStringKeyedObject(sampleContext.reference)
          ? sampleContext.reference
          : { value: sampleContext.reference },
        metadata: isStringKeyedObject(sampleContext.metadata)
          ? sampleContext.metadata
          : {},
      },
    });
  }, [store, sampleContext]);
  useEffect(() => {
    function publish() {
      const current = store.getState();

      const name =
        current.evaluator.globalName.trim() ||
        `evaluator_${slotId.toLowerCase()}`;

      const outputNames: SlotOutput[] = current.outputConfigs.map((config) =>
        "values" in config
          ? {
              name: config.name,
              labels: config.values.map((value) => value.label),
              labelScores: Object.fromEntries(
                config.values.flatMap((value) =>
                  value.score != null ? [[value.label, value.score]] : []
                )
              ),
              lowerBound: null,
              upperBound: null,
            }
          : {
              name: config.name,
              labels: [],
              labelScores: {},
              lowerBound: config.lowerBound ?? null,
              upperBound: config.upperBound ?? null,
            }
      );

      const selectedOutputName = outputNames.some(
        (output) => output.name === selectedOutput
      )
        ? selectedOutput
        : (outputNames[0]?.name ?? "");

      let validationError: string | null =
        getEvaluatorOutputConfigValidationErrors({
          kind,
          configs: current.outputConfigs,
        }).join("\n") || null;

      let preview: SlotSnapshot["preview"] = null;

      try {
        if (kind === "CODE")
          preview = {
            inlineCodeEvaluator: {
              name,
              language,
              sourceCode,
              sandboxConfigId,
              outputConfigs: buildOutputConfigsInput(current.outputConfigs),
            },
          };
        else if (playgroundStore) {
          const payload = createLLMEvaluatorPayload({
            playgroundStore,
            instanceId: playgroundStore.getState().instances[0].id,
            name,
            description: current.evaluator.description,
            outputConfigs: current.outputConfigs,
            datasetId: datasetId ?? "",
            inputMapping: current.evaluator.inputMapping,
            includeExplanation: current.evaluator.includeExplanation,
          });

          preview = {
            inlineLlmEvaluator: {
              name: payload.name,
              description: payload.description,
              outputConfigs: payload.outputConfigs,
              promptVersion: payload.promptVersion,
            },
          };
        }
      } catch (error) {
        validationError =
          error instanceof Error
            ? error.message
            : "Complete the evaluator configuration.";
      }

      if (kind === "CODE")
        validationError ??= getCodeSlotValidationError({
          sourceCode,
          language,
          sandboxConfigId,
          sandboxConfigs,
        });

      if (!outputNames.length) validationError = "Choose an output to review.";

      const revision = JSON.stringify({
        preview,
        inputMapping: current.evaluator.inputMapping,
        selectedOutputName,
      });

      initialRevision.current ??= revision;

      const next: SlotSnapshot = {
        revision,
        isDirty: revision !== (savedRevision ?? initialRevision.current),
        kind,
        name,
        outputNames,
        selectedOutputName,
        preview,
        inputMapping: current.evaluator.inputMapping,
        validationError,
      };

      setSnapshot((previous) =>
        previous?.revision === next.revision &&
        previous.validationError === next.validationError &&
        previous.isDirty === next.isDirty
          ? previous
          : next
      );
      onSnapshotChange(next);
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

    const unsubscribePlayground =
      kind === "LLM"
        ? playgroundStore?.subscribe((current, previous) => {
            // These are the inputs read by getInstancePromptParamsFromStore.
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
    kind,
    language,
    sourceCode,
    sandboxConfigId,
    sandboxConfigs,
    selectedOutput,
    datasetId,
    slotId,
    savedRevision,
  ]);

  /**
   * Saves the draft to `saveTarget`, or as a new evaluator named as a copy of
   * the draft when the dialog's "Save as new" asks for one. PXI saves take the
   * target as is.
   */
  async function save({
    asNew = false,
  }: { asNew?: boolean } = {}): Promise<UIOperationResult> {
    setSaveError(null);

    if (
      !datasetId ||
      !snapshot?.preview ||
      !(await store.getState().validateAll())
    )
      return {
        ok: false,
        error: "Select a dataset and complete evaluator setup before saving.",
      };
    const draftName = store.getState().evaluator.globalName.trim();

    if (!draftName) {
      setSaveError(NAME_REQUIRED_ERROR);
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set(tabKey, "output");

          return next;
        },
        { replace: true }
      );

      return { ok: false, error: NAME_REQUIRED_ERROR };
    }

    try {
      // The copy's name lands in the draft too, so the slot shows what was
      // saved and the user can rename it afterwards.
      const name = asNew ? await copyName(draftName, datasetId) : draftName;

      if (asNew) store.getState().setEvaluatorGlobalName(name);

      const saved = await saveSlot({
        target: asNew ? { action: "create" } : saveTarget,
        datasetId,
        name,
        description: store.getState().evaluator.description.trim() || undefined,
        preview: snapshot.preview,
        inputMapping: snapshot.inputMapping,
        promptVersionId:
          playgroundStore?.getState().instances[0]?.prompt?.version ?? null,
        sandboxConfigId,
        initialSandboxConfigId: initialSandboxConfigId ?? null,
      });

      setSavedRevision(snapshot.revision);
      adoptSavedPrompt(playgroundStore, saved.prompt);

      if (saved.action === "created")
        props.onSelectionChange?.({
          evaluatorId: null,
          datasetEvaluatorId: saved.datasetEvaluatorId,
        });

      return {
        ok: true,
        output: {
          datasetEvaluatorId: saved.datasetEvaluatorId,
          action: saved.action,
          name,
        },
      };
    } catch (error) {
      const message = getSaveErrorMessage(error);
      setSaveError(message);

      return { ok: false, error: message };
    }
  }

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const modelConfigByProvider = usePreferencesContext(
    (state) => state.modelConfigByProvider
  );

  useEffect(() => {
    let local = { language, sourceCode, sandboxConfigId, selectedOutput };

    const host = createEvaluatorAgentSlot({
      slotId,
      modelCatalog,
      sourceKey: initialDatasetEvaluatorId ?? initialEvaluatorId ?? "new-llm",
      saveTarget,
      kind,
      store,
      playgroundStore: playgroundStore ?? null,
      getLocal: () => local,
      setLocal: (next) => {
        local = next;
        setLanguage(next.language);
        setSourceCode(next.sourceCode);
        setSandboxConfigId(next.sandboxConfigId);
        setSelectedOutput(next.selectedOutput);
      },
      getPreferences: () => modelConfigByProvider,
      sandboxConfigs,
      save: () => saveRef.current(),
    });

    return registerAgentSlot?.(slotId, host);
  }, [
    modelCatalog,
    kind,
    store,
    playgroundStore,
    language,
    sourceCode,
    sandboxConfigId,
    selectedOutput,
    modelConfigByProvider,
    sandboxConfigs,
    registerAgentSlot,
    initialDatasetEvaluatorId,
    initialEvaluatorId,
    saveTarget,
    slotId,
  ]);

  const currentSnapshot = snapshot ?? {
    isDirty: false,
    revision: "",
    validationError: null,
    selectedOutputName: "",
    outputNames: [],
  };

  const isActionDisabled = !datasetId || !!currentSnapshot.validationError;

  const status = getSlotStatus({
    savedRevision,
    revision: currentSnapshot.revision,
    isDirty: currentSnapshot.isDirty,
  });

  const content = (
    <Flex direction="column" gap="size-100">
      <EvaluatorSlotToolbar
        slotId={slotId}
        sourceControl={sourceControl}
        status={status}
        validationError={currentSnapshot.validationError}
        isSaving={isSaving}
        isRunning={isRunning}
        isSaveDisabled={isSaving || isActionDisabled}
        onSave={() => setIsSaveDialogOpen(true)}
        onRemove={onRemove}
      />
      <SaveEvaluatorSlotDialog
        slotId={slotId}
        target={saveTarget}
        isOpen={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        isSaving={isSaving}
        error={saveError}
        onSave={async (options) => {
          const result = await save(options);

          if (result.ok) setIsSaveDialogOpen(false);

          return result;
        }}
      />
      {/* PXI saves report here; the dialog shows its own errors. */}
      {saveError && !isSaveDialogOpen ? (
        <Alert variant="danger" title="Could not save evaluator">
          {saveError}
        </Alert>
      ) : null}
      <Tabs
        css={slotTabsCSS}
        selectedKey={selectedTab}
        onSelectionChange={(key) =>
          setSearchParams(
            (previous) => {
              const next = new URLSearchParams(previous);
              next.set(tabKey, String(key));

              return next;
            },
            { replace: true }
          )
        }
      >
        <TabList>
          <Tab id="editor">{kind === "CODE" ? "Code" : "Prompt"}</Tab>
          <Tab id="mapping">Input mapping</Tab>
          <Tab id="output">Output</Tab>
        </TabList>
        <TabPanel id="editor" css={slotTabPanelCSS}>
          {kind === "LLM" ? (
            <EvaluatorChatTemplate />
          ) : (
            <Flex direction="column" gap="size-200">
              <Flex direction="row" gap="size-100" alignItems="center">
                <CodeEvaluatorLanguageField
                  hideLabel
                  isDisabled={saveTarget.action !== "create"}
                  language={language}
                  onChange={(next) => {
                    setLanguage(next);
                    setSandboxConfigId(
                      getDefaultSandboxConfigId({
                        sandboxConfigs,
                        language: next,
                      })
                    );
                    setSourceCode(
                      getDefaultCodeEvaluatorSource(next, "dataset")
                    );
                  }}
                />
                <CodeEvaluatorSandboxField
                  hideLabel
                  sandboxConfigs={sandboxConfigs}
                  language={language}
                  selectedSandboxConfigId={sandboxConfigId}
                  onSelectionChange={setSandboxConfigId}
                />
              </Flex>
              <CodeEvaluatorSourceEditor
                hideDescription
                language={language}
                sourceCode={sourceCode}
                onChange={setSourceCode}
              />
            </Flex>
          )}
        </TabPanel>
        <TabPanel id="mapping" css={slotTabPanelCSS}>
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
        <TabPanel id="output" css={slotTabPanelCSS}>
          <Flex direction="column" gap="size-200">
            <TextField
              aria-label={`Evaluator ${slotId} name`}
              value={globalName}
              onChange={setEvaluatorGlobalName}
              isInvalid={saveError === NAME_REQUIRED_ERROR}
            >
              <Label>Name</Label>
              <Input placeholder="e.g. correctness" />
              <Text slot="description">{SAVE_EFFECTS[saveTarget.action]}.</Text>
            </TextField>
            {currentSnapshot.outputNames.length > 1 ? (
              <Select
                aria-label="Output to compare"
                value={currentSnapshot.selectedOutputName || null}
                onChange={(key) => {
                  if (key != null) setSelectedOutput(String(key));
                }}
              >
                <Label>Output to compare</Label>
                <Button>
                  <SelectValue />
                  <SelectChevronUpDownIcon />
                </Button>
                <Popover>
                  <ListBox>
                    {currentSnapshot.outputNames.map((output) => (
                      <SelectItem key={output.name} id={output.name}>
                        {output.name}
                      </SelectItem>
                    ))}
                  </ListBox>
                </Popover>
              </Select>
            ) : null}
            <EvaluatorSlotOutput name={currentSnapshot.selectedOutputName} />
          </Flex>
        </TabPanel>
      </Tabs>
    </Flex>
  );

  return kind === "LLM" ? (
    <LLMEvaluatorInputVariablesProvider>
      {content}
    </LLMEvaluatorInputVariablesProvider>
  ) : (
    <CodeEvaluatorInputVariablesProvider
      variables={extractCodeEvaluatorVariables({ language, sourceCode })}
    >
      {content}
    </CodeEvaluatorInputVariablesProvider>
  );
}

/** The slot's title row: which evaluator it holds, its save state, and its actions. */
function EvaluatorSlotToolbar({
  slotId,
  sourceControl,
  status,
  validationError,
  isSaving,
  isRunning,
  isSaveDisabled,
  onSave,
  onRemove,
}: {
  slotId: EvaluatorSlotProps["slotId"];
  sourceControl: ReactNode;
  status: string | null;
  /** Why the slot can't run yet. Shown inline so it never shifts the layout. */
  validationError: string | null;
  isSaving: boolean;
  isRunning: boolean;
  isSaveDisabled: boolean;
  onSave: () => void;
  onRemove?: () => void;
}) {
  return (
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
      >
        {sourceControl}
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
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.Save />} />}
          onPress={onSave}
          isDisabled={isSaveDisabled}
          isPending={isSaving}
        >
          Save
        </Button>
        {onRemove ? (
          <TooltipTrigger>
            <Button
              size="S"
              aria-label={`Remove evaluator ${slotId}`}
              leadingVisual={<Icon svg={<Icons.Trash />} />}
              isDisabled={isRunning}
              onPress={onRemove}
            />
            <Tooltip>
              <TooltipArrow />
              Remove evaluator {slotId} from the comparison
            </Tooltip>
          </TooltipTrigger>
        ) : null}
      </Flex>
    </Flex>
  );
}

const NAME_REQUIRED_ERROR = "Enter a name before saving.";

/**
 * Points the judge prompt at the version the save produced, so the next save
 * diffs against it instead of appending a duplicate version.
 */
function adoptSavedPrompt(
  playgroundStore: PlaygroundStore | null | undefined,
  prompt: PlaygroundInstancePrompt | null
) {
  const instanceId = playgroundStore?.getState().instances[0]?.id;

  if (!playgroundStore || !prompt || instanceId == null) return;
  playgroundStore
    .getState()
    .updateInstance({ instanceId, patch: { prompt }, dirty: null });
}

function getSaveErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  return (
    getErrorMessagesFromRelayMutationError(error)?.join("\n") ?? error.message
  );
}

// Warning-toned inline notice; the icon and text share the color.
const validationCSS = css`
  color: var(--global-color-warning);
`;

// The slot already sits inside the panel's inset, so the first tab label lines
// up with the slot's left edge (the index icon above it) rather than adding the
// tab's own padding on top of that inset.
const slotTabsCSS = css`
  > .react-aria-TabList {
    flex-shrink: 0;
  }

  .react-aria-Tab:first-of-type {
    padding-inline-start: 0;
  }
`;

// The same breathing room below the tab bar as the toolbar has above it.
const slotTabPanelCSS = css`
  padding-top: var(--global-dimension-size-100);
`;

/**
 * A clean, never-saved draft says nothing — only a change worth saving, or a
 * successful save, earns a status.
 */
function getSlotStatus({
  savedRevision,
  revision,
  isDirty,
}: {
  savedRevision: string | null;
  revision: string;
  isDirty: boolean;
}): string | null {
  if (savedRevision != null && savedRevision === revision) return "Saved";

  return isDirty ? "Unsaved changes" : null;
}
