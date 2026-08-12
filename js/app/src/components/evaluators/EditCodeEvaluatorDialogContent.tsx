import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { indentUnit } from "@codemirror/language";
import { css } from "@emotion/react";
import CodeMirror from "@uiw/react-codemirror";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import { createEvaluatorHostSubmit } from "@phoenix/agent/tools/approval";
import {
  applyDraftOperations,
  type CodeEvaluatorDraftHost,
  type CodeEvaluatorDraftSnapshot,
  createEditCodeEvaluatorDraftClientAction,
  createReadCodeEvaluatorDraftClientAction,
  createSubmitCodeEvaluatorDraftClientAction,
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  type EditCodeEvaluatorDraftOperation,
  type EvaluatorSubmitResult,
  fromOutputConfigDraft,
  READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  type SandboxConfigIndex,
  SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  toOutputConfigDrafts,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import {
  Alert,
  Button,
  CopyToClipboardButton,
  Flex,
  Heading,
  Icon,
  Icons,
  Input,
  Label,
  LinkButton,
  List,
  ListItem,
  NumberField,
  SectionHeading,
  Switch,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { pierreDark, pierreLight } from "@phoenix/components/code";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import {
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
} from "@phoenix/components/core/menu";
import { createEvaluatorAutocompletion } from "@phoenix/components/evaluators/codeEvaluatorAutocomplete";
import {
  CodeEvaluatorLanguageField,
  CodeEvaluatorSandboxField,
  type SandboxConfigOption,
} from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import { CODE_EVALUATOR_TEMPLATES } from "@phoenix/components/evaluators/codeEvaluatorTemplates";
import { CodeEvaluatorTestSection } from "@phoenix/components/evaluators/CodeEvaluatorTestSection";
import { generateEvaluatorTypes } from "@phoenix/components/evaluators/codeEvaluatorTypeGeneration";
import {
  extractCodeEvaluatorVariables,
  getAllGeneratedSources,
  getDefaultCodeEvaluatorSource,
} from "@phoenix/components/evaluators/codeEvaluatorUtils";
import { EvaluatorDescriptionInput } from "@phoenix/components/evaluators/EvaluatorDescriptionInput";
import { EvaluatorExampleDataset } from "@phoenix/components/evaluators/EvaluatorExampleDataset";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorInputPreview } from "@phoenix/components/evaluators/EvaluatorInputPreview";
import { CodeEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/CodeEvaluatorInputVariablesProvider";
import { EvaluatorNameInput } from "@phoenix/components/evaluators/EvaluatorNameInput";
import { OptimizationDirectionField } from "@phoenix/components/evaluators/OptimizationDirectionField";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { useTheme } from "@phoenix/contexts";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import type {
  CodeEvaluatorLanguage,
  FreeformEvaluatorAnnotationConfig,
} from "@phoenix/types";

export const createDefaultFreeformOutputConfig = (
  name: string
): FreeformEvaluatorAnnotationConfig => ({
  name,
  optimizationDirection: "NONE",
  threshold: null,
  lowerBound: null,
  upperBound: null,
});

export const EditCodeEvaluatorDialogContent = ({
  onSubmit,
  onCancel,
  onDirtyChange,
  isSubmitting,
  mode,
  error,
  initialLanguage,
  initialSourceCode,
  sandboxConfigs,
  initialSandboxConfigId,
  evaluatorNodeId,
}: {
  onSubmit: (payload: {
    language: CodeEvaluatorLanguage;
    sourceCode: string;
    sandboxConfigId?: string | null;
  }) => Promise<EvaluatorSubmitResult>;
  /**
   * Called when the user clicks Cancel. Parent overlays can use this to
   * centralize close behavior such as unsaved-change confirmation.
   */
  onCancel?: () => void;
  /**
   * Called whenever the dirty state changes (has unsaved changes vs. not).
   */
  onDirtyChange?: (isDirty: boolean) => void;
  isSubmitting: boolean;
  mode: "create" | "update";
  error?: string;
  initialLanguage: CodeEvaluatorLanguage;
  initialSourceCode: string;
  sandboxConfigs: SandboxConfigOption[];
  initialSandboxConfigId?: string | null;
  evaluatorNodeId?: string | null;
}) => {
  const store = useEvaluatorStoreInstance();
  const [showValidationError, setShowValidationError] = useState(false);
  const [sourceCode, setSourceCode] = useState(initialSourceCode);
  const [language, setLanguage] =
    useState<CodeEvaluatorLanguage>(initialLanguage);
  const [sandboxConfigId, setSandboxConfigId] = useState<string | null>(
    initialSandboxConfigId ?? null
  );
  const [localValidationError, setLocalValidationError] = useState<
    string | undefined
  >();

  // Track initial store state for dirty checking
  const initialStoreStateRef = useRef<{
    name: string;
    globalName: string;
    description: string;
    outputConfigs: string;
    inputMapping: string;
    evaluatorMappingSource: string;
  } | null>(null);

  // Track last reported dirty state to avoid redundant callbacks
  const lastDirtyRef = useRef(false);

  useEffect(() => {
    // Capture initial store state on mount for dirty comparison
    const state = store.getState();
    initialStoreStateRef.current = {
      name: state.evaluator.name,
      globalName: state.evaluator.globalName,
      description: state.evaluator.description,
      outputConfigs: JSON.stringify(state.outputConfigs),
      inputMapping: JSON.stringify(state.evaluator.inputMapping),
      evaluatorMappingSource: JSON.stringify(state.evaluatorMappingSource),
    };
  }, [store]);

  const reportDirtyState = useEffectEvent((isDirty: boolean) => {
    onDirtyChange?.(isDirty);
  });

  const checkForDirtyChanges = useEffectEvent(() => {
    const initial = initialStoreStateRef.current;
    if (!initial) {
      return;
    }

    const state = store.getState();
    const codeChanged = sourceCode !== initialSourceCode;
    const languageChanged = language !== initialLanguage;
    const sandboxChanged = sandboxConfigId !== (initialSandboxConfigId ?? null);
    const nameChanged = state.evaluator.name !== initial.name;
    const globalNameChanged = state.evaluator.globalName !== initial.globalName;
    const descriptionChanged =
      state.evaluator.description !== initial.description;
    const outputConfigsChanged =
      JSON.stringify(state.outputConfigs) !== initial.outputConfigs;
    const inputMappingChanged =
      JSON.stringify(state.evaluator.inputMapping) !== initial.inputMapping;
    const evaluatorMappingSourceChanged =
      JSON.stringify(state.evaluatorMappingSource) !==
      initial.evaluatorMappingSource;

    const isDirty =
      codeChanged ||
      languageChanged ||
      sandboxChanged ||
      nameChanged ||
      globalNameChanged ||
      descriptionChanged ||
      outputConfigsChanged ||
      inputMappingChanged ||
      evaluatorMappingSourceChanged;

    if (isDirty !== lastDirtyRef.current) {
      lastDirtyRef.current = isDirty;
      reportDirtyState(isDirty);
    }
  });

  // Notify parent of dirty state changes from local state
  useEffect(() => {
    checkForDirtyChanges();
  }, [sourceCode, language, sandboxConfigId]);

  // Subscribe to store changes to notify parent of dirty state
  useEffect(() => {
    return store.subscribe(() => {
      checkForDirtyChanges();
    });
  }, [store]);

  const agentStore = useAgentStore();

  const advertisedCodeEvaluatorContext = useMemo(
    () => ({
      type: "code_evaluator" as const,
      evaluatorNodeId: evaluatorNodeId ?? null,
    }),
    [evaluatorNodeId]
  );
  useAdvertiseAgentContext(advertisedCodeEvaluatorContext);

  const localFieldsRef = useRef({ sourceCode, language, sandboxConfigId });
  useEffect(() => {
    localFieldsRef.current = { sourceCode, language, sandboxConfigId };
  }, [sourceCode, language, sandboxConfigId]);

  const sandboxConfigIndex: SandboxConfigIndex = useMemo(() => {
    const index: SandboxConfigIndex = {};
    for (const config of sandboxConfigs) {
      index[config.id] = { language: config.language };
    }
    return index;
  }, [sandboxConfigs]);
  const sandboxConfigIndexRef = useRef(sandboxConfigIndex);
  useEffect(() => {
    sandboxConfigIndexRef.current = sandboxConfigIndex;
  }, [sandboxConfigIndex]);

  const draftHostRef = useRef<CodeEvaluatorDraftHost | null>(null);
  const isDraftMounted = useCallback(() => draftHostRef.current != null, []);

  const handleSubmitRef = useRef<(() => Promise<EvaluatorSubmitResult>) | null>(
    null
  );

  useEffect(() => {
    const buildSnapshot = (): CodeEvaluatorDraftSnapshot => {
      const local = localFieldsRef.current;
      const state = store.getState();
      const firstOutputConfigName = state.outputConfigs[0]?.name ?? "";
      const draftName =
        state.evaluator.name ||
        state.evaluator.globalName ||
        firstOutputConfigName;
      return {
        mode: mode === "create" ? "create" : "edit",
        evaluatorNodeId: evaluatorNodeId ?? null,
        name: draftName,
        description: state.evaluator.description,
        language: local.language,
        sourceCode: local.sourceCode,
        sandboxConfigId: local.sandboxConfigId,
        inputMapping: state.evaluator.inputMapping,
        testPayload: state.evaluatorMappingSource,
        outputConfigs: toOutputConfigDrafts(state.outputConfigs),
      };
    };

    const previewOperations = (
      snapshot: CodeEvaluatorDraftSnapshot,
      operations: EditCodeEvaluatorDraftOperation[]
    ) =>
      applyDraftOperations({
        snapshot,
        operations,
        sandboxConfigs: sandboxConfigIndexRef.current,
      });

    const applyOperations = (operations: EditCodeEvaluatorDraftOperation[]) => {
      const current = buildSnapshot();
      const proposed = previewOperations(current, operations);
      if (!proposed.ok) return proposed;
      const next = proposed.output;
      localFieldsRef.current = {
        sourceCode: next.sourceCode,
        language: next.language,
        sandboxConfigId: next.sandboxConfigId,
      };
      if (next.sourceCode !== current.sourceCode) {
        setSourceCode(next.sourceCode);
      }
      if (next.language !== current.language) {
        setLanguage(next.language);
      }
      if (next.sandboxConfigId !== current.sandboxConfigId) {
        setSandboxConfigId(next.sandboxConfigId);
      }
      const state = store.getState();
      const currentStoredName =
        state.evaluator.name || state.evaluator.globalName;
      const proposedOutputConfigName = next.outputConfigs[0]?.name ?? "";
      const hasExplicitNameOperation = operations.some(
        (operation) => operation.type === "set_name"
      );
      const nextStoredName =
        mode === "create" && !currentStoredName && !hasExplicitNameOperation
          ? proposedOutputConfigName || next.name
          : next.name;
      if (nextStoredName && nextStoredName !== currentStoredName) {
        if (mode === "create") {
          state.setEvaluatorGlobalName(nextStoredName);
        }
        state.setEvaluatorName(nextStoredName);
      }
      if (next.description !== current.description) {
        state.setEvaluatorDescription(next.description);
      }
      if (
        JSON.stringify(next.outputConfigs) !==
        JSON.stringify(current.outputConfigs)
      ) {
        state.setOutputConfigs(next.outputConfigs.map(fromOutputConfigDraft));
      }
      if (
        JSON.stringify(next.inputMapping.pathMapping) !==
        JSON.stringify(current.inputMapping.pathMapping)
      ) {
        state.setPathMapping(next.inputMapping.pathMapping);
      }
      if (
        JSON.stringify(next.inputMapping.literalMapping) !==
        JSON.stringify(current.inputMapping.literalMapping)
      ) {
        state.setLiteralMapping(next.inputMapping.literalMapping);
      }
      if (
        JSON.stringify(next.testPayload) !== JSON.stringify(current.testPayload)
      ) {
        state.setEvaluatorMappingSource(next.testPayload);
      }
      return { ok: true as const, output: buildSnapshot() };
    };

    const host: CodeEvaluatorDraftHost = {
      getSnapshot: buildSnapshot,
      previewOperations,
      applyOperations,
      submit: createEvaluatorHostSubmit({
        getHandleSubmit: () => handleSubmitRef.current,
        unmountedError:
          "The code-evaluator form is not mounted; cannot submit.",
      }),
    };
    draftHostRef.current = host;

    const {
      registerClientAction,
      unregisterClientAction,
      setPendingCodeEvaluatorEdit,
    } = agentStore.getState();
    const getDraftHost = () => draftHostRef.current;
    registerClientAction(
      READ_CODE_EVALUATOR_DRAFT_TOOL_NAME,
      createReadCodeEvaluatorDraftClientAction({ getDraftHost })
    );
    registerClientAction(
      EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
      createEditCodeEvaluatorDraftClientAction({
        getDraftHost,
        setPendingCodeEvaluatorEdit,
        shouldAutoAccept: () =>
          agentStore.getState().permissions.edits === "bypass",
      })
    );
    registerClientAction(
      SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
      createSubmitCodeEvaluatorDraftClientAction({
        getDraftHost,
        shouldAutoAccept: () =>
          agentStore.getState().permissions.edits === "bypass",
      })
    );
    return () => {
      draftHostRef.current = null;
      handleSubmitRef.current = null;
      unregisterClientAction(READ_CODE_EVALUATOR_DRAFT_TOOL_NAME);
      unregisterClientAction(EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME);
      unregisterClientAction(SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME);
      for (const pendingEdit of Object.values(
        agentStore.getState().pendingCodeEvaluatorEditsByToolCallId
      )) {
        if (pendingEdit) {
          void pendingEdit.cancel?.();
        }
      }
    };
  }, [agentStore, store, mode, evaluatorNodeId]);

  const handleCancel = () => {
    onCancel?.();
  };

  const variables = useMemo(
    () => extractCodeEvaluatorVariables({ language, sourceCode }),
    [language, sourceCode]
  );

  const compatibleSandboxConfigs = useMemo(
    () =>
      sandboxConfigs.filter(
        (sandboxConfig) => sandboxConfig.language === language
      ),
    [language, sandboxConfigs]
  );

  const selectedSandboxConfigId = compatibleSandboxConfigs.some(
    (sandboxConfig) => sandboxConfig.id === sandboxConfigId
  )
    ? sandboxConfigId
    : null;
  const hasUnavailableSandboxSelection =
    sandboxConfigId != null && selectedSandboxConfigId == null;
  const unavailableSandboxSelectionMessage = hasUnavailableSandboxSelection
    ? "The previously selected sandbox is no longer available. Save to keep the existing sandbox, or choose a new one to update it."
    : undefined;
  const hasNoSandboxConfigs = sandboxConfigs.length === 0;
  const selectedSandboxConfig =
    sandboxConfigs.find(
      (sandboxConfig) => sandboxConfig.id === selectedSandboxConfigId
    ) ?? null;

  const handleSubmit = async (): Promise<EvaluatorSubmitResult> => {
    const isValid = await store.getState().validateAll();
    const configError = getCodeEvaluatorValidationError({
      outputConfigs: store.getState().outputConfigs,
      sourceCode,
      mode,
      sandboxConfigId: selectedSandboxConfigId,
    });
    if (!isValid || configError) {
      setShowValidationError(true);
      setLocalValidationError(configError);
      return {
        ok: false,
        error:
          configError ?? "Please fix the highlighted errors before submitting.",
      };
    }
    setShowValidationError(false);
    setLocalValidationError(undefined);
    const hasSandboxChanged =
      sandboxConfigId !== (initialSandboxConfigId ?? null);
    const nextSandboxConfigId =
      selectedSandboxConfigId != null
        ? selectedSandboxConfigId
        : mode === "create" || hasSandboxChanged
          ? null
          : undefined;
    return onSubmit({
      language,
      sourceCode,
      sandboxConfigId: nextSandboxConfigId,
    });
  };
  handleSubmitRef.current = handleSubmit;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Create Code Evaluator" : "Edit Code Evaluator"}
        </DialogTitle>
        <DialogTitleExtra>
          {onCancel ? (
            <Button isDisabled={isSubmitting} onPress={handleCancel}>
              Cancel
            </Button>
          ) : (
            <Button slot="close" isDisabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button
            variant="primary"
            isDisabled={isSubmitting}
            isPending={isSubmitting}
            onPress={handleSubmit}
          >
            {mode === "create" ? "Create" : "Update"}
          </Button>
        </DialogTitleExtra>
      </DialogHeader>

      <fieldset disabled={isSubmitting} css={fieldsetCSS}>
        {/* Error alerts */}
        {showValidationError && (
          <Alert
            variant="danger"
            title="Please fix the highlighted errors before submitting."
          />
        )}
        {localValidationError && (
          <Alert variant="danger" title="Invalid code evaluator configuration">
            {localValidationError}
          </Alert>
        )}
        {error && (
          <Alert
            variant="danger"
            title={
              mode === "create"
                ? "Failed to create evaluator"
                : "Failed to update evaluator"
            }
          >
            {error}
          </Alert>
        )}
        {hasNoSandboxConfigs ? (
          <Alert
            variant="warning"
            banner
            extra={
              <LinkButton size="S" to="/settings/sandboxes">
                Configure a sandbox
              </LinkButton>
            }
          >
            No sandboxes configured. Configure a sandbox before creating,
            testing, or executing a code evaluator.
          </Alert>
        ) : null}

        {unavailableSandboxSelectionMessage ? (
          <Alert variant="warning" banner>
            {unavailableSandboxSelectionMessage}
          </Alert>
        ) : null}

        <CodeEvaluatorInputVariablesProvider variables={variables}>
          <Group orientation="horizontal" style={{ flex: 1, minHeight: 0 }}>
            {/* Left panel: Code Editor (60%) */}
            <Panel defaultSize="60%" minSize="40%" style={panelStyle}>
              <div css={editorPanelCSS}>
                <EvaluatorMetadataForm
                  language={language}
                  onLanguageChange={(nextLanguage) => {
                    setLanguage((currentLanguage) => {
                      // Auto-swap only if sourceCode is still a generated
                      // placeholder — never overwrite user-authored code.
                      const currentDefaults =
                        getAllGeneratedSources(currentLanguage);
                      if (currentDefaults.includes(sourceCode)) {
                        setSourceCode(
                          getDefaultCodeEvaluatorSource(nextLanguage)
                        );
                      }
                      return nextLanguage;
                    });
                  }}
                  sandboxConfigs={sandboxConfigs}
                  selectedSandboxConfigId={selectedSandboxConfigId}
                  onSandboxChange={setSandboxConfigId}
                  isLanguageEditable={mode === "create"}
                  isSandboxRequired={mode === "create"}
                />
                <CodeEditor
                  language={language}
                  sourceCode={sourceCode}
                  onChange={setSourceCode}
                />
                <EvaluatorAnnotationSection />
                <InputMappingSection />
              </div>
            </Panel>

            <Separator css={compactResizeHandleCSS} />

            {/* Right panel: Collapsible Sidebar (40%) */}
            <Panel defaultSize="40%" minSize="25%" style={panelStyle}>
              <div css={sidebarPanelCSS}>
                <ConfiguratorSidebar
                  selectedSandboxConfig={selectedSandboxConfig}
                  selectedSandboxConfigId={selectedSandboxConfigId}
                  sourceCode={sourceCode}
                  language={language}
                  isDraftMounted={isDraftMounted}
                />
              </div>
            </Panel>
          </Group>
        </CodeEvaluatorInputVariablesProvider>
      </fieldset>
    </DialogContent>
  );
};

/**
 * Top-of-panel form for the evaluator's identifying metadata:
 * Name, Language, Sandbox, and Description.
 */
const EvaluatorMetadataForm = ({
  language,
  onLanguageChange,
  sandboxConfigs,
  selectedSandboxConfigId,
  onSandboxChange,
  isLanguageEditable,
  isSandboxRequired,
}: {
  language: CodeEvaluatorLanguage;
  onLanguageChange: (language: CodeEvaluatorLanguage) => void;
  sandboxConfigs: SandboxConfigOption[];
  selectedSandboxConfigId: string | null;
  onSandboxChange: (sandboxConfigId: string | null) => void;
  isLanguageEditable?: boolean;
  isSandboxRequired?: boolean;
}) => {
  return (
    <div css={metadataFormCSS}>
      <div style={{ flex: "0 0 260px" }}>
        <EvaluatorNameInput isRequired />
      </div>
      <div style={{ flex: "0 0 260px" }}>
        <CodeEvaluatorLanguageField
          language={language}
          onChange={onLanguageChange}
          isDisabled={!isLanguageEditable}
          isRequired
        />
      </div>
      <div style={{ flex: "0 0 260px" }}>
        <CodeEvaluatorSandboxField
          sandboxConfigs={sandboxConfigs}
          language={language}
          selectedSandboxConfigId={selectedSandboxConfigId}
          onSelectionChange={onSandboxChange}
          isRequired={isSandboxRequired}
        />
      </div>
      <div style={{ flex: "1 1 240px", minWidth: 180 }}>
        <EvaluatorDescriptionInput placeholder="e.g. code evaluator description" />
      </div>
    </div>
  );
};

const ConfiguratorSidebar = ({
  selectedSandboxConfig,
  selectedSandboxConfigId,
  sourceCode,
  language,
  isDraftMounted,
}: {
  selectedSandboxConfig: SandboxConfigOption | null;
  selectedSandboxConfigId: string | null;
  sourceCode: string;
  language: CodeEvaluatorLanguage;
  isDraftMounted: () => boolean;
}) => {
  return (
    <>
      {/* Scrollable "Test Evaluator" region */}
      <div css={sidebarScrollAreaCSS}>
        <SectionHeading bordered={false}>
          <Text weight="heavy" size="S">
            Test Evaluator
          </Text>
        </SectionHeading>
        <div css={sectionContentCSS}>
          <View marginY="size-100" paddingX="size-200">
            <CodeEvaluatorTestSection
              sourceCode={sourceCode}
              language={language}
              sandboxConfigId={selectedSandboxConfigId}
              isDraftMounted={isDraftMounted}
            />
          </View>
          <View paddingX="size-200" paddingTop="size-50">
            <EvaluatorExampleDataset />
          </View>
          <View marginTop="size-100">
            <EvaluatorInputPreview />
          </View>
        </div>
      </div>

      {/* "Sandbox Config" pinned to the bottom and always visible */}
      <div css={sidebarFooterCSS}>
        <SectionHeading bordered={false}>
          <Text weight="heavy" size="M">
            Sandbox Config
          </Text>
        </SectionHeading>
        <SandboxConfigSummary selectedSandboxConfig={selectedSandboxConfig} />
      </div>
    </>
  );
};

const SandboxConfigSummary = ({
  selectedSandboxConfig,
}: {
  selectedSandboxConfig: SandboxConfigOption | null;
}) => {
  if (selectedSandboxConfig == null) {
    return (
      <View padding="size-200">
        <Text color="text-500" size="XS">
          Choose a sandbox to review its configured execution settings.
        </Text>
      </View>
    );
  }
  return (
    <List size="M">
      <SandboxConfigRow label="Name" value={selectedSandboxConfig.name} />
      {selectedSandboxConfig.timeout != null ? (
        <SandboxConfigRow
          label="Timeout"
          value={`${selectedSandboxConfig.timeout} seconds`}
        />
      ) : null}
      <SandboxConfigRow
        label="Environment variables"
        value={getSandboxEnvVarsLabel(selectedSandboxConfig.config)}
      />
      <SandboxConfigRow
        label="Internet access"
        value={getSandboxInternetAccessConfigLabel(
          selectedSandboxConfig.config
        )}
      />
      <SandboxConfigRow
        label="Dependencies"
        value={getSandboxDependenciesConfigLabel(selectedSandboxConfig.config)}
      />
    </List>
  );
};

const SandboxConfigRow = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => {
  return (
    <ListItem>
      <View paddingStart="size-100" paddingEnd="size-100">
        <Flex direction="row" justifyContent="space-between" gap="size-200">
          <Text size="S" color="text-700">
            {label}
          </Text>
          <Text size="S">{value}</Text>
        </Flex>
      </View>
    </ListItem>
  );
};

type SandboxConfigForLabels = {
  readonly envVars: ReadonlyArray<{ readonly name: string }>;
  readonly internetAccess: { readonly mode: "ALLOW" | "DENY" } | null;
  readonly dependencies: { readonly packages: ReadonlyArray<string> } | null;
};

function getSandboxEnvVarsLabel(config: SandboxConfigForLabels) {
  const names = config.envVars.map((ev) => ev.name);
  return names.length > 0 ? names.join(", ") : "none";
}

function getSandboxInternetAccessConfigLabel(config: SandboxConfigForLabels) {
  if (config.internetAccess == null) return "not configured";
  return config.internetAccess.mode === "ALLOW" ? "allow" : "deny";
}

function getSandboxDependenciesConfigLabel(config: SandboxConfigForLabels) {
  if (config.dependencies == null) return "none";
  const packages = config.dependencies.packages;
  return packages.length > 0 ? packages.join(", ") : "none";
}

/**
 * Editable source-code editor with a read-only auto-generated type footer.
 * Ships its own description line and Reset-to-default button.
 */
const CodeEditor = ({
  language,
  sourceCode,
  onChange,
}: {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
  onChange: (value: string) => void;
}) => {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? pierreLight : pierreDark;
  // The auto-generated type footer is hidden by default.
  const [showTypes, setShowTypes] = useState(false);

  // Get the evaluator mapping source from the store for type generation
  const evaluatorMappingSource = useEvaluatorStore(
    (state) => state.evaluatorMappingSource
  );

  // Generate the type footer based on language and available data
  const typeFooter = useMemo(
    () => generateEvaluatorTypes(language, evaluatorMappingSource),
    [language, evaluatorMappingSource]
  );

  const extensions = useMemo(
    () => [
      language === "PYTHON" ? python() : javascript({ typescript: true }),
      // Python: 4-space indent; JS/TS: 2-space.
      indentUnit.of(language === "PYTHON" ? "    " : "  "),
      createEvaluatorAutocompletion(evaluatorMappingSource, language),
    ],
    [language, evaluatorMappingSource]
  );

  const descriptionText =
    "Define an evaluate function that returns a score or label.";

  return (
    <Flex direction="column" gap="size-100">
      {/* Editor header with controls */}
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap="size-200"
        flex="none"
      >
        <Text color="text-500" size="XS">
          {descriptionText}
        </Text>
        <Flex direction="row" alignItems="center" gap="size-100" flex="none">
          <MenuTrigger>
            <Button
              size="S"
              variant="quiet"
              leadingVisual={<Icon svg={<Icons.Code />} />}
            >
              Templates
            </Button>
            <MenuContainer placement="bottom end" maxWidth={360}>
              <Menu
                onAction={(key) => {
                  const template = CODE_EVALUATOR_TEMPLATES.find(
                    (t) => t.id === key
                  );
                  if (!template) {
                    return;
                  }
                  onChange(template.getSource(language));
                }}
              >
                {CODE_EVALUATOR_TEMPLATES.map((template) => (
                  <MenuItem
                    key={template.id}
                    id={template.id}
                    textValue={`${template.name}\n${template.description}`}
                  >
                    <Flex direction="column" gap="size-50">
                      <Text weight="heavy">{template.name}</Text>
                      <Text size="S" color="text-700">
                        {template.description}
                      </Text>
                    </Flex>
                  </MenuItem>
                ))}
              </Menu>
            </MenuContainer>
          </MenuTrigger>
          <Button
            size="S"
            variant="quiet"
            leadingVisual={<Icon svg={<Icons.Refresh />} />}
            onPress={() => onChange(getDefaultCodeEvaluatorSource(language))}
          >
            Reset
          </Button>
          <CopyToClipboardButton
            text={sourceCode}
            size="S"
            variant="quiet"
            tooltipText="Copy code"
          >
            Copy
          </CopyToClipboardButton>
          {typeFooter ? (
            <Switch
              isSelected={showTypes}
              onChange={setShowTypes}
              labelPlacement="start"
            >
              <Text size="S">Show types</Text>
            </Switch>
          ) : null}
        </Flex>
      </Flex>

      {/* Code editor and type footer with resizable panels */}
      <div css={editorContainerCSS}>
        <Group orientation="vertical" style={{ flex: 1, minHeight: 0 }}>
          {/* Editable code editor panel */}
          <Panel defaultSize="75%" minSize="30%" style={editorPanelStyle}>
            <div
              css={[editorWrapCSS, cmLineNumberGutterCSS]}
              onKeyDown={(e) => {
                if (e.key === "Escape" || e.key === "Tab") {
                  e.stopPropagation();
                }
              }}
            >
              <CodeMirror
                // Key on language to force remount when language changes
                key={language}
                value={sourceCode}
                onChange={onChange}
                theme={codeMirrorTheme}
                extensions={extensions}
                height="100%"
                indentWithTab
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  bracketMatching: true,
                  syntaxHighlighting: true,
                  highlightActiveLine: false,
                  highlightActiveLineGutter: false,
                  tabSize: language === "PYTHON" ? 4 : 2,
                }}
              />
            </div>
          </Panel>

          {/* Read-only type footer panel */}
          {showTypes && typeFooter && (
            <>
              <Separator css={compactResizeHandleCSS} />
              <Panel defaultSize="25%" minSize="10%" style={editorPanelStyle}>
                <div css={[typeFooterCSS, cmLineNumberGutterCSS]}>
                  <CodeMirror
                    value={typeFooter}
                    theme={codeMirrorTheme}
                    extensions={extensions}
                    editable={false}
                    basicSetup={{
                      lineNumbers: true,
                      foldGutter: true,
                      bracketMatching: true,
                      syntaxHighlighting: true,
                      highlightActiveLine: false,
                      highlightActiveLineGutter: false,
                      tabSize: language === "PYTHON" ? 4 : 2,
                    }}
                  />
                </div>
              </Panel>
            </>
          )}
        </Group>
      </div>
    </Flex>
  );
};

/**
 * Heading + bordered card for the evaluator's output annotation config.
 */
const EvaluatorAnnotationSection = () => {
  return (
    <View flex="none">
      <Flex direction="column" gap="size-100">
        <Heading level={2} weight="heavy">
          Evaluator Annotation
        </Heading>
        <Text color="text-500">
          Define the annotation that your evaluator will create. Optimization
          direction, score range, and threshold apply only when your evaluator
          returns a numeric score.
        </Text>
        <View
          borderRadius="medium"
          borderWidth="thin"
          padding="size-200"
          marginTop="size-50"
          borderColor="default"
        >
          <OutputConfigSection />
        </View>
      </Flex>
    </View>
  );
};

/**
 * Heading + bordered card for mapping evaluator arguments to dataset fields.
 */
const InputMappingSection = () => {
  return (
    <View flex="none">
      <Flex direction="column" gap="size-100">
        <Heading level={2} weight="heavy">
          Input Mapping (optional)
        </Heading>
        <Text color="text-500">
          Map evaluator arguments to dataset fields. Arguments are auto-detected
          from your code.
        </Text>
        <View
          borderRadius="medium"
          borderWidth="thin"
          padding="size-200"
          marginTop="size-50"
          borderColor="default"
        >
          <EvaluatorInputMapping />
        </View>
      </Flex>
    </View>
  );
};

const OutputConfigSection = () => {
  const store = useEvaluatorStoreInstance();
  const outputConfig = useEvaluatorStore((state) => state.outputConfigs[0]);
  const setOutputConfigThresholdAtIndex = useEvaluatorStore(
    (state) => state.setOutputConfigThresholdAtIndex
  );
  const setOutputConfigLowerBoundAtIndex = useEvaluatorStore(
    (state) => state.setOutputConfigLowerBoundAtIndex
  );
  const setOutputConfigUpperBoundAtIndex = useEvaluatorStore(
    (state) => state.setOutputConfigUpperBoundAtIndex
  );

  useEffect(() => {
    if (!outputConfig) {
      const state = store.getState();
      const name = state.evaluator.name || state.evaluator.globalName;
      state.setOutputConfigs([createDefaultFreeformOutputConfig(name)]);
    }
  }, [outputConfig, store]);

  if (!outputConfig) {
    return null;
  }

  if ("values" in outputConfig) {
    return (
      <Flex direction="column" gap="size-200">
        <Flex direction="row" gap="size-200" alignItems="start">
          <TextField isDisabled value={outputConfig.name}>
            <Label>Name</Label>
            <Input />
          </TextField>
          <OptimizationDirectionField description="Whether higher or lower scores are better." />
        </Flex>
        <Flex direction="column" gap="size-100">
          <OutputConfigValuesHeader />
          {outputConfig.values.map((value, index) => (
            <OutputConfigValuesRow
              key={`${value.label}-${index}`}
              label={value.label}
              score={value.score ?? null}
              index={index}
            />
          ))}
        </Flex>
      </Flex>
    );
  }

  const threshold =
    "threshold" in outputConfig ? (outputConfig.threshold ?? null) : null;
  const lowerBound =
    "lowerBound" in outputConfig ? (outputConfig.lowerBound ?? null) : null;
  const upperBound =
    "upperBound" in outputConfig ? (outputConfig.upperBound ?? null) : null;
  const optimizationDirection = outputConfig.optimizationDirection;
  const isThresholdDisabled = optimizationDirection === "NONE";

  const thresholdDescription =
    optimizationDirection === "MAXIMIZE"
      ? "Scores at or above this value display as good; lower scores display as bad."
      : optimizationDirection === "MINIMIZE"
        ? "Scores at or below this value display as good; higher scores display as bad."
        : "Combined with the optimization direction, this is the cutoff used to visually distinguish “good” from “bad” scores.";

  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="row" gap="size-200" alignItems="start">
        <TextField isDisabled value={outputConfig.name}>
          <Label>Name</Label>
          <Input />
        </TextField>
        <OptimizationDirectionField description="Whether higher or lower scores are better." />
        <NumberField
          value={threshold ?? undefined}
          onChange={(value) =>
            setOutputConfigThresholdAtIndex(
              0,
              Number.isNaN(value) ? null : value
            )
          }
          isDisabled={isThresholdDisabled}
        >
          <Label>Score threshold (optional)</Label>
          <Input />
          <Text slot="description">{thresholdDescription}</Text>
        </NumberField>
      </Flex>
      <Flex direction="row" gap="size-200" alignItems="start">
        <NumberField
          value={lowerBound ?? undefined}
          onChange={(value) =>
            setOutputConfigLowerBoundAtIndex(
              0,
              Number.isNaN(value) ? null : value
            )
          }
        >
          <Label>Minimum score (optional)</Label>
          <Input />
          <Text slot="description">
            The lowest score your evaluator is expected to produce.
          </Text>
        </NumberField>
        <NumberField
          value={upperBound ?? undefined}
          onChange={(value) =>
            setOutputConfigUpperBoundAtIndex(
              0,
              Number.isNaN(value) ? null : value
            )
          }
        >
          <Label>Maximum score (optional)</Label>
          <Input />
          <Text slot="description">
            The highest score your evaluator is expected to produce.
          </Text>
        </NumberField>
      </Flex>
    </Flex>
  );
};

const OutputConfigValuesHeader = () => {
  return (
    <div css={outputConfigValuesGridCSS}>
      <Text>Choice</Text>
      <Text>Score</Text>
    </div>
  );
};

const OutputConfigValuesRow = ({
  label,
  score,
  index,
}: {
  label: string;
  score: number | null;
  index: number;
}) => {
  return (
    <div css={outputConfigValuesGridCSS}>
      <TextField isDisabled value={label} aria-label={`Choice ${index + 1}`}>
        <Input />
      </TextField>
      <TextField
        isDisabled
        value={score != null ? String(score) : ""}
        aria-label={`Score ${index + 1}`}
      >
        <Input />
      </TextField>
    </div>
  );
};

// Validation helper
const getCodeEvaluatorValidationError = ({
  outputConfigs,
  sourceCode,
  mode,
  sandboxConfigId,
}: {
  outputConfigs: AnnotationConfig[];
  sourceCode: string;
  mode: "create" | "update";
  sandboxConfigId: string | null;
}) => {
  if (sourceCode.trim().length === 0) {
    return "Source code is required.";
  }
  if (outputConfigs.length === 0) {
    return "At least one output config is required.";
  }
  // Require sandbox selection when creating a new evaluator
  if (mode === "create" && sandboxConfigId == null) {
    return "Please select a sandbox configuration.";
  }
  return undefined;
};

// Styles
const fieldsetCSS = css`
  all: unset;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const metadataFormCSS = css`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: var(--global-dimension-size-150);
  flex-shrink: 0;
`;

const panelStyle = {
  height: "100%",
  display: "flex",
  flexDirection: "column" as const,
  minHeight: 0,
  overflow: "hidden" as const,
};

const editorPanelCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: var(--global-dimension-size-150);
  padding-top: var(--global-dimension-size-100);
  box-sizing: border-box;
  overflow-y: auto;
  gap: var(--global-dimension-size-150);
`;

const sidebarPanelCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
  border-left: 1px solid var(--global-border-color-default);
`;

const outputConfigValuesGridCSS = css`
  width: 100%;
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: var(--global-dimension-size-100);
  align-items: start;
`;

// The "Test Evaluator" region grows to fill the panel and scrolls on overflow.
const sidebarScrollAreaCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
`;

// The "Sandbox Config" region is pinned to the bottom of the panel and stays
// visible. It scrolls internally if its content gets tall, but is capped so the
// test region always keeps room.
const sidebarFooterCSS = css`
  flex: 0 0 auto;
  max-height: 50%;
  overflow-y: auto;
  border-top: 1px solid var(--global-border-color-default);
`;

const sectionContentCSS = css`
  padding: var(--global-dimension-size-50) 0;
  padding-bottom: var(--global-dimension-size-150);
`;

const editorContainerCSS = css`
  display: flex;
  flex-direction: column;
  min-height: 500px;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  overflow: hidden;
  background-color: var(--code-mirror-editor-background-color);
`;

const editorPanelStyle = {
  display: "flex",
  flexDirection: "column" as const,
  minHeight: 0,
  overflow: "hidden" as const,
};

const cmLineNumberGutterCSS = css`
  & .cm-gutter.cm-lineNumbers .cm-gutterElement {
    min-width: 2.25em;
    box-sizing: border-box;
  }
`;

const editorWrapCSS = css`
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  & .cm-theme {
    height: 100% !important;
  }

  & .cm-editor {
    height: 100% !important;
  }

  & .cm-scroller {
    overflow: auto !important;
  }
`;

const typeFooterCSS = css`
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  & .cm-theme {
    height: 100% !important;
  }

  & .cm-editor {
    height: 100% !important;
    background-color: var(--global-color-gray-100);
  }

  & .cm-gutters {
    background-color: var(--global-color-gray-100);
  }

  & .cm-scroller {
    overflow: auto !important;
  }
`;
