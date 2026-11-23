import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

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
  Flex,
  LinkButton,
  List,
  ListItem,
  Text,
  View,
} from "@phoenix/components";
import { CodeAuthoringFields } from "@phoenix/components/evaluators/CodeAuthoringFields";
import type { SandboxConfigOption } from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import { CodeEvaluatorTestSection } from "@phoenix/components/evaluators/CodeEvaluatorTestSection";
import { extractCodeEvaluatorVariables } from "@phoenix/components/evaluators/codeEvaluatorUtils";
import { makeDatasetEvaluatorFormLayout } from "@phoenix/components/evaluators/datasetEvaluatorFormLayout";
import { EvaluatorFormDialogContent } from "@phoenix/components/evaluators/EvaluatorFormDialogContent";
import { CodeEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/CodeEvaluatorInputVariablesProvider";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import { EvaluatorValidationBanner } from "@phoenix/components/evaluators/EvaluatorValidationBanner";
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
  codeEvaluatorNodeId,
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
  /** Relay node ID of the underlying code evaluator, not an association wrapper. */
  codeEvaluatorNodeId?: string | null;
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
      evaluatorNodeId: codeEvaluatorNodeId ?? null,
    }),
    [codeEvaluatorNodeId]
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
        evaluatorNodeId: codeEvaluatorNodeId ?? null,
        name: draftName,
        description: state.evaluator.description,
        language: local.language,
        sourceCode: local.sourceCode,
        sandboxConfigId: local.sandboxConfigId,
        inputMapping: state.evaluator.inputMapping,
        testPayload: state.evaluatorMappingSource.source,
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
        state.setEvaluatorMappingSource({
          recordKind: state.evaluatorMappingSource.recordKind,
          source: next.testPayload,
        });
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
  }, [agentStore, store, mode, codeEvaluatorNodeId]);

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
  // eslint-disable-next-line react/refs
  handleSubmitRef.current = handleSubmit;

  return (
    <EvaluatorFormDialogContent
      title={
        mode === "create" ? "Create Code Evaluator" : "Edit Code Evaluator"
      }
      submitLabel={mode === "create" ? "Create" : "Update"}
      onCancel={onCancel ? handleCancel : undefined}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      error={error}
      errorTitle={
        mode === "create"
          ? "Failed to create evaluator"
          : "Failed to update evaluator"
      }
      banner={
        <>
          {showValidationError ? <EvaluatorValidationBanner /> : null}
          {localValidationError ? (
            <Alert
              variant="danger"
              title="Invalid code evaluator configuration"
            >
              {localValidationError}
            </Alert>
          ) : null}
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
        </>
      }
      renderInputVariables={(body) => (
        <CodeEvaluatorInputVariablesProvider variables={variables}>
          {body}
        </CodeEvaluatorInputVariablesProvider>
      )}
      {...makeDatasetEvaluatorFormLayout({
        evaluatorKind: "code",
        identity: (
          <EvaluatorNameAndDescriptionFields
            isNameRequired
            descriptionPlaceholder="e.g. code evaluator description"
          />
        ),
        sections: [
          {
            id: "code",
            title: "Code",
            content: (
              <>
                <CodeAuthoringFields
                  language={language}
                  onLanguageChange={setLanguage}
                  sandboxConfigs={sandboxConfigs}
                  selectedSandboxConfigId={selectedSandboxConfigId}
                  onSandboxChange={setSandboxConfigId}
                  sourceCode={sourceCode}
                  onSourceCodeChange={setSourceCode}
                  isLanguageDisabled={mode !== "create"}
                  isSandboxRequired={mode === "create"}
                  resetSource={
                    mode === "update"
                      ? {
                          language: initialLanguage,
                          sourceCode: initialSourceCode,
                          kind: "saved",
                        }
                      : null
                  }
                />
                <SandboxConfigSection
                  selectedSandboxConfig={selectedSandboxConfig}
                />
              </>
            ),
          },
        ],
        testSection: (
          <CodeEvaluatorTestSection
            sourceCode={sourceCode}
            language={language}
            sandboxConfigId={selectedSandboxConfigId}
            isDraftMounted={isDraftMounted}
          />
        ),
      })}
    />
  );
};

/** The selected sandbox's execution settings, to review before saving. */
const SandboxConfigSection = ({
  selectedSandboxConfig,
}: {
  selectedSandboxConfig: SandboxConfigOption | null;
}) => (
  <View marginTop="size-200">
    <Flex direction="column" gap="size-100">
      <EvaluatorSectionHeader
        title="Sandbox Config"
        description="How the selected sandbox runs this evaluator."
      />
      <SandboxConfigSummary selectedSandboxConfig={selectedSandboxConfig} />
    </Flex>
  </View>
);

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
