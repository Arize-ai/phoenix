import { css } from "@emotion/react";
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
  type EditCodeEvaluatorDraftOperation,
  type EvaluatorSubmitResult,
  fromOutputConfigDraft,
  type SandboxConfigIndex,
  toOutputConfigDrafts,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import { registerUIOperations } from "@phoenix/agent/uiOperations/catalog";
import {
  editCodeEvaluatorDraftOperation,
  readCodeEvaluatorDraftOperation,
  submitCodeEvaluatorDraftOperation,
} from "@phoenix/agent/uiOperations/operations/codeEvaluatorDraft";
import {
  Alert,
  Button,
  Flex,
  Heading,
  LinkButton,
  List,
  ListItem,
  SectionHeading,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { CodeAuthoringFields } from "@phoenix/components/evaluators/CodeAuthoringFields";
import type { SandboxConfigOption } from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import { CodeEvaluatorTestSection } from "@phoenix/components/evaluators/CodeEvaluatorTestSection";
import {
  extractCodeEvaluatorVariables,
  getNextCodeEvaluatorSource,
} from "@phoenix/components/evaluators/codeEvaluatorUtils";
import { EvaluatorExampleDataset } from "@phoenix/components/evaluators/EvaluatorExampleDataset";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorInputPreview } from "@phoenix/components/evaluators/EvaluatorInputPreview";
import { CodeEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/CodeEvaluatorInputVariablesProvider";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import type { CodeEvaluatorLanguage } from "@phoenix/types";

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
      evaluatorMappingSource: JSON.stringify(
        state.evaluatorMappingSource.source
      ),
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
      JSON.stringify(state.evaluatorMappingSource.source) !==
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
  const sandboxConfigsRef = useRef(sandboxConfigs);
  useEffect(() => {
    sandboxConfigsRef.current = sandboxConfigs;
  }, [sandboxConfigs]);

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
        testPayload: state.evaluatorMappingSource.source,
        outputConfigs: toOutputConfigDrafts(state.outputConfigs),
        availableSandboxConfigs: sandboxConfigsRef.current.map((config) => ({
          id: config.id,
          name: config.name,
          language: config.language,
          backendType: config.backendType,
        })),
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

    const { setPendingCodeEvaluatorEdit } = agentStore.getState();
    const getDraftHost = () => draftHostRef.current;
    const unregister = registerUIOperations({
      agentStore,
      operations: [
        {
          descriptor: readCodeEvaluatorDraftOperation,
          handler: createReadCodeEvaluatorDraftClientAction({ getDraftHost }),
        },
        {
          descriptor: editCodeEvaluatorDraftOperation,
          handler: createEditCodeEvaluatorDraftClientAction({
            getDraftHost,
            setPendingCodeEvaluatorEdit,
            shouldAutoAccept: () =>
              agentStore.getState().permissions.edits === "bypass",
          }),
        },
        {
          descriptor: submitCodeEvaluatorDraftOperation,
          handler: createSubmitCodeEvaluatorDraftClientAction({
            getDraftHost,
            shouldAutoAccept: () =>
              agentStore.getState().permissions.edits === "bypass",
          }),
        },
      ],
    });
    return () => {
      draftHostRef.current = null;
      handleSubmitRef.current = null;
      unregister();
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

  const handleLanguageChange = (nextLanguage: CodeEvaluatorLanguage) => {
    setSourceCode(
      getNextCodeEvaluatorSource({ sourceCode, language, nextLanguage })
    );
    setLanguage(nextLanguage);
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
  // eslint-disable-next-line react/refs
  handleSubmitRef.current = handleSubmit;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Create Code Evaluator" : "Edit Code Evaluator"}
        </DialogTitle>
        <DialogTitleExtra>
          {onCancel ? (
            <DialogCloseButton
              isDisabled={isSubmitting}
              onPress={handleCancel}
            />
          ) : (
            <DialogCloseButton isDisabled={isSubmitting} />
          )}
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
                <EvaluatorNameAndDescriptionFields
                  isNameRequired
                  descriptionPlaceholder="e.g. code evaluator description"
                />
                <CodeAuthoringFields
                  language={language}
                  onLanguageChange={handleLanguageChange}
                  sandboxConfigs={sandboxConfigs}
                  selectedSandboxConfigId={selectedSandboxConfigId}
                  onSandboxChange={setSandboxConfigId}
                  sourceCode={sourceCode}
                  onSourceCodeChange={setSourceCode}
                  isLanguageDisabled={mode !== "create"}
                  isSandboxRequired={mode === "create"}
                />
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
      <DialogFooter>
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
      </DialogFooter>
    </DialogContent>
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
  // keep trackpad overscroll from chaining to the dialog and
  // dragging the header/footer with it
  overscroll-behavior: contain;
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

// The "Test Evaluator" region grows to fill the panel and scrolls on overflow.
const sidebarScrollAreaCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  // keep trackpad overscroll from chaining to the dialog and
  // dragging the header/footer with it
  overscroll-behavior: contain;
`;

// The "Sandbox Config" region is pinned to the bottom of the panel and stays
// visible. It scrolls internally if its content gets tall, but is capped so the
// test region always keeps room.
const sidebarFooterCSS = css`
  flex: 0 0 auto;
  max-height: 50%;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-top: 1px solid var(--global-border-color-default);
`;

const sectionContentCSS = css`
  padding: var(--global-dimension-size-50) 0;
  padding-bottom: var(--global-dimension-size-150);
`;
