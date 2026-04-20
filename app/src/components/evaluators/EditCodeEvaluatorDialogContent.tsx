import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { css } from "@emotion/react";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror from "@uiw/react-codemirror";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

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
  Text,
  TextField,
  View,
} from "@phoenix/components";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
} from "@phoenix/components/core/disclosure";
import { createEvaluatorAutocompletion } from "@phoenix/components/evaluators/codeEvaluatorAutocomplete";
import {
  CodeEvaluatorLanguageField,
  CodeEvaluatorSandboxField,
  type SandboxConfigOption,
} from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import { CodeEvaluatorTestSection } from "@phoenix/components/evaluators/CodeEvaluatorTestSection";
import { generateEvaluatorTypes } from "@phoenix/components/evaluators/codeEvaluatorTypeGeneration";
import {
  DEFAULT_CODE_EVALUATOR_SOURCE,
  extractCodeEvaluatorVariables,
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
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import type {
  ClassificationChoice,
  CodeEvaluatorLanguage,
  ContinuousEvaluatorAnnotationConfig,
} from "@phoenix/types";

const outputTypeOptions = [
  { id: "continuous", label: "Continuous score" },
  { id: "categorical", label: "Categorical label" },
] as const;

export const createDefaultContinuousOutputConfig = (
  name: string
): ContinuousEvaluatorAnnotationConfig => ({
  name,
  optimizationDirection: "NONE",
  lowerBound: 0,
  upperBound: 1,
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
}: {
  onSubmit: (payload: {
    language: CodeEvaluatorLanguage;
    sourceCode: string;
    sandboxConfigId?: string | null;
  }) => void;
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
    outputConfigs: string;
    inputMapping: string;
  } | null>(null);

  // Track last reported dirty state to avoid redundant callbacks
  const lastDirtyRef = useRef(false);

  useEffect(() => {
    // Capture initial store state on mount for dirty comparison
    const state = store.getState();
    initialStoreStateRef.current = {
      name: state.evaluator.name,
      outputConfigs: JSON.stringify(state.outputConfigs),
      inputMapping: JSON.stringify(state.evaluator.inputMapping),
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
    const outputConfigsChanged =
      JSON.stringify(state.outputConfigs) !== initial.outputConfigs;
    const inputMappingChanged =
      JSON.stringify(state.evaluator.inputMapping) !== initial.inputMapping;

    const isDirty =
      codeChanged ||
      languageChanged ||
      sandboxChanged ||
      nameChanged ||
      outputConfigsChanged ||
      inputMappingChanged;

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
        (sandboxConfig) => sandboxConfig.providerLanguage === language
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

  const handleSubmit = async () => {
    const isValid = await store.getState().validateAll();
    const configError = getCodeEvaluatorValidationError({
      outputConfigs: store.getState().outputConfigs,
      sourceCode,
    });
    if (!isValid || configError) {
      setShowValidationError(true);
      setLocalValidationError(configError);
      return;
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
    onSubmit({
      language,
      sourceCode,
      sandboxConfigId: nextSandboxConfigId,
    });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Create Evaluator" : "Edit Evaluator"}
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
          <Alert variant="warning" title="No sandboxes configured">
            You can still draft and save this evaluator now. Select a sandbox
            later to test or execute it.
          </Alert>
        ) : null}

        {/* Compact inline header bar */}
        <CompactHeaderBar
          language={language}
          onLanguageChange={(nextLanguage) => {
            setLanguage((currentLanguage) => {
              if (
                sourceCode === DEFAULT_CODE_EVALUATOR_SOURCE[currentLanguage]
              ) {
                setSourceCode(DEFAULT_CODE_EVALUATOR_SOURCE[nextLanguage]);
              }
              return nextLanguage;
            });
          }}
          sandboxConfigs={sandboxConfigs}
          selectedSandboxConfigId={selectedSandboxConfigId}
          onSandboxChange={setSandboxConfigId}
          unavailableSelectionMessage={unavailableSandboxSelectionMessage}
          showSandboxHelperText={hasNoSandboxConfigs}
        />

        <CodeEvaluatorInputVariablesProvider variables={variables}>
          <Group orientation="horizontal" style={{ flex: 1, minHeight: 0 }}>
            {/* Left panel: Code Editor (60%) */}
            <Panel defaultSize="60%" minSize="40%" style={panelStyle}>
              <div css={editorPanelCSS}>
                <CodeEditorSection
                  language={language}
                  sourceCode={sourceCode}
                  onChange={setSourceCode}
                />
              </div>
            </Panel>

            <Separator css={compactResizeHandleCSS} />

            {/* Right panel: Collapsible Sidebar (40%) */}
            <Panel defaultSize="40%" minSize="25%" style={panelStyle}>
              <div css={sidebarPanelCSS}>
                <DisclosureGroup
                  defaultExpandedKeys={["output-config", "input-mapping"]}
                >
                  {/* Test Section */}
                  <Disclosure id="test-section" defaultExpanded={false}>
                    <DisclosureTrigger arrowPosition="start">
                      <Text weight="heavy" size="S">
                        Test Evaluator
                      </Text>
                    </DisclosureTrigger>
                    <DisclosurePanel>
                      <div css={accordionContentCSS}>
                        <View marginY="size-100" paddingX="size-200">
                          <CodeEvaluatorTestSection
                            sourceCode={sourceCode}
                            language={language}
                            sandboxConfigId={selectedSandboxConfigId}
                          />
                        </View>
                        <View paddingX="size-200" paddingTop="size-50">
                          <EvaluatorExampleDataset />
                        </View>
                        <View marginTop="size-100">
                          <EvaluatorInputPreview />
                        </View>
                      </div>
                    </DisclosurePanel>
                  </Disclosure>

                  {/* Output Configuration Section */}
                  <Disclosure id="output-config">
                    <DisclosureTrigger arrowPosition="start">
                      <Text weight="heavy" size="S">
                        Output Configuration
                      </Text>
                    </DisclosureTrigger>
                    <DisclosurePanel>
                      <div css={accordionContentCSS}>
                        <View paddingX="size-200" paddingTop="size-100">
                          <Text color="text-500" size="XS">
                            Define the output type and optimization direction
                            for your evaluator.
                          </Text>
                          <View marginTop="size-100">
                            <OutputConfigSection />
                          </View>
                        </View>
                      </div>
                    </DisclosurePanel>
                  </Disclosure>

                  {/* Input Mapping Section */}
                  <Disclosure id="input-mapping">
                    <DisclosureTrigger arrowPosition="start">
                      <Text weight="heavy" size="S">
                        Input Mapping
                      </Text>
                    </DisclosureTrigger>
                    <DisclosurePanel>
                      <div css={accordionContentCSS}>
                        <View paddingX="size-200" paddingTop="size-100">
                          <Text color="text-500" size="XS">
                            Map evaluator arguments to dataset fields. Arguments
                            are auto-detected from your code.
                          </Text>
                          <View marginTop="size-100">
                            <EvaluatorInputMapping />
                          </View>
                        </View>
                      </div>
                    </DisclosurePanel>
                  </Disclosure>
                </DisclosureGroup>
              </div>
            </Panel>
          </Group>
        </CodeEvaluatorInputVariablesProvider>
      </fieldset>
    </DialogContent>
  );
};

/**
 * Compact header bar with inline name, language, and sandbox fields
 */
const CompactHeaderBar = ({
  language,
  onLanguageChange,
  sandboxConfigs,
  selectedSandboxConfigId,
  onSandboxChange,
  unavailableSelectionMessage,
  showSandboxHelperText,
}: {
  language: CodeEvaluatorLanguage;
  onLanguageChange: (language: CodeEvaluatorLanguage) => void;
  sandboxConfigs: SandboxConfigOption[];
  selectedSandboxConfigId: string | null;
  onSandboxChange: (sandboxConfigId: string | null) => void;
  unavailableSelectionMessage?: string;
  showSandboxHelperText?: boolean;
}) => {
  return (
    <Flex direction="column" gap="size-100">
      <div css={headerBarCSS}>
        {/* Name field */}
        <div
          css={headerFieldCSS}
          style={{ flex: "1 1 180px", minWidth: 140, maxWidth: 500 }}
        >
          <EvaluatorNameInput />
        </div>

        {/* Description field */}
        <div css={headerFieldCSS} style={{ flex: "1 1 240px", minWidth: 180 }}>
          <EvaluatorDescriptionInput />
        </div>

        {/* Language selector */}
        <div css={headerFieldCSS} style={{ flex: "0 0 auto", width: 130 }}>
          <CodeEvaluatorLanguageField
            language={language}
            onChange={onLanguageChange}
          />
        </div>

        {/* Sandbox selector */}
        <div css={headerFieldCSS} style={{ flex: "0 1 240px", minWidth: 180 }}>
          <CodeEvaluatorSandboxField
            sandboxConfigs={sandboxConfigs}
            language={language}
            selectedSandboxConfigId={selectedSandboxConfigId}
            onSelectionChange={onSandboxChange}
            showHelperText={showSandboxHelperText}
            unavailableSelectionMessage={unavailableSelectionMessage}
          />
        </div>
      </div>
    </Flex>
  );
};

/**
 * Code editor section - full height, primary element
 * Includes auto-generated type definitions as a read-only footer below the editor.
 */
const CodeEditorSection = ({
  language,
  sourceCode,
  onChange,
}: {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
  onChange: (value: string) => void;
}) => {
  const { theme } = useTheme();
  const codeMirrorTheme = theme === "light" ? githubLight : githubDark;

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
      createEvaluatorAutocompletion(evaluatorMappingSource, language),
    ],
    [language, evaluatorMappingSource]
  );

  return (
    <div css={editorSectionCSS}>
      {/* Editor header with reset button */}
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        flex="none"
      >
        <Text color="text-500" size="XS">
          Define an <code>evaluate</code> function that returns a score or
          label.
        </Text>
        <Button
          size="S"
          variant="quiet"
          onPress={() => onChange(DEFAULT_CODE_EVALUATOR_SOURCE[language])}
        >
          <Icon svg={<Icons.Refresh />} />
          Reset
        </Button>
      </Flex>

      {/* Code editor and type footer with resizable panels */}
      <div css={editorContainerCSS}>
        <Group orientation="vertical" style={{ flex: 1, minHeight: 0 }}>
          {/* Editable code editor panel */}
          <Panel defaultSize="75%" minSize="30%" style={editorPanelStyle}>
            <div
              css={editorWrapCSS}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
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
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  bracketMatching: true,
                  syntaxHighlighting: true,
                  highlightActiveLine: false,
                  highlightActiveLineGutter: false,
                }}
              />
            </div>
          </Panel>

          {/* Read-only type footer panel */}
          {typeFooter && (
            <>
              <Separator css={compactResizeHandleCSS} />
              <Panel defaultSize="25%" minSize="10%" style={editorPanelStyle}>
                <div css={typeFooterCSS}>
                  <CodeMirror
                    value={typeFooter}
                    theme={codeMirrorTheme}
                    extensions={extensions}
                    editable={false}
                    basicSetup={{
                      lineNumbers: true,
                      foldGutter: false,
                      highlightActiveLine: false,
                      highlightActiveLineGutter: false,
                    }}
                  />
                </div>
              </Panel>
            </>
          )}
        </Group>
      </div>
    </div>
  );
};

/**
 * Output configuration section (inside accordion)
 */
const OutputConfigSection = () => {
  const store = useEvaluatorStoreInstance();
  const outputConfig = useEvaluatorStore((state) => state.outputConfigs[0]);
  const evaluatorName = useEvaluatorStore(
    (state) => state.evaluator.name || state.evaluator.globalName
  );
  const outputType =
    outputConfig && "values" in outputConfig ? "categorical" : "continuous";

  useEffect(() => {
    if (!outputConfig) {
      store
        .getState()
        .setOutputConfigs([createDefaultContinuousOutputConfig(evaluatorName)]);
    }
  }, [evaluatorName, outputConfig, store]);

  if (!outputConfig) {
    return null;
  }

  return (
    <Flex direction="column" gap="size-100">
      <TextField isDisabled value={outputConfig.name}>
        <Label>Annotation name</Label>
        <Input />
        <Text slot="description">
          The name of the annotation that will be created by this evaluator.
          Fixed to the evaluator name.
        </Text>
      </TextField>

      <Select
        value={outputType}
        onChange={(value) => {
          const nextType = value as (typeof outputTypeOptions)[number]["id"];
          store.getState().setOutputConfigs([
            nextType === "categorical"
              ? {
                  name: evaluatorName,
                  optimizationDirection: "NONE",
                  values: [
                    { label: "pass", score: 1 },
                    { label: "fail", score: 0 },
                  ],
                }
              : createDefaultContinuousOutputConfig(evaluatorName),
          ]);
        }}
      >
        <Label>Output type</Label>
        <Button>
          <SelectValue />
          <SelectChevronUpDownIcon />
        </Button>
        <Text slot="description">
          The type of output that will be created by this evaluator. Your code
          should return a numerical score or a categorical label.
        </Text>
        <Popover>
          <ListBox>
            {outputTypeOptions.map((option) => (
              <SelectItem key={option.id} id={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </ListBox>
        </Popover>
      </Select>

      <OptimizationDirectionField />

      {"values" in outputConfig ? (
        <CategoricalChoicesEditor values={outputConfig.values} />
      ) : (
        <ContinuousBoundsEditor config={outputConfig} />
      )}
    </Flex>
  );
};

const CategoricalChoicesEditor = ({
  values,
}: {
  values: ClassificationChoice[];
}) => {
  const setOutputConfigs = useEvaluatorStore((state) => state.setOutputConfigs);
  const outputConfig = useEvaluatorStore((state) => state.outputConfigs[0]);

  if (!outputConfig || !("values" in outputConfig)) {
    return null;
  }

  const updateValues = (nextValues: ClassificationChoice[]) => {
    setOutputConfigs([{ ...outputConfig, values: nextValues }]);
  };

  return (
    <Flex direction="column" gap="size-100">
      <Text weight="heavy" size="XS">
        Choices
      </Text>
      {values.map((choice, index) => (
        <div key={`${index}-${choice.label}`} css={choiceGridCSS}>
          <TextField
            value={choice.label}
            onChange={(label) => {
              const nextValues = [...values];
              nextValues[index] = { ...choice, label };
              updateValues(nextValues);
            }}
          >
            <Input placeholder={`Choice ${index + 1}`} />
          </TextField>
          <TextField
            value={choice.score != null ? String(choice.score) : ""}
            onChange={(value) => {
              const nextValues = [...values];
              nextValues[index] = {
                ...choice,
                score: value.trim() === "" ? undefined : Number(value),
              };
              updateValues(nextValues);
            }}
          >
            <Input type="number" placeholder="Score" />
          </TextField>
          <Button
            type="button"
            variant="quiet"
            aria-label="Remove choice"
            size="S"
            isDisabled={values.length <= 2}
            onPress={() => {
              if (values.length <= 2) return;
              updateValues(values.filter((_, i) => i !== index));
            }}
          >
            <Icon svg={<Icons.TrashOutline />} />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="quiet"
        size="S"
        onPress={() =>
          updateValues([...values, { label: "", score: undefined }])
        }
      >
        + Add choice
      </Button>
    </Flex>
  );
};

const ContinuousBoundsEditor = ({
  config,
}: {
  config: ContinuousEvaluatorAnnotationConfig;
}) => {
  const setOutputConfigs = useEvaluatorStore((state) => state.setOutputConfigs);

  const updateConfig = (
    updates: Partial<ContinuousEvaluatorAnnotationConfig>
  ) => {
    setOutputConfigs([{ ...config, ...updates }]);
  };

  return (
    <Flex direction="row" gap="size-100">
      <TextField
        value={config.lowerBound != null ? String(config.lowerBound) : ""}
        onChange={(value) =>
          updateConfig({
            lowerBound: value.trim() === "" ? null : Number(value),
          })
        }
      >
        <Label>Lower bound</Label>
        <Input type="number" placeholder="0" />
      </TextField>
      <TextField
        value={config.upperBound != null ? String(config.upperBound) : ""}
        onChange={(value) =>
          updateConfig({
            upperBound: value.trim() === "" ? null : Number(value),
          })
        }
      >
        <Label>Upper bound</Label>
        <Input type="number" placeholder="1" />
      </TextField>
    </Flex>
  );
};

// Validation helper
const getCodeEvaluatorValidationError = ({
  outputConfigs,
  sourceCode,
}: {
  outputConfigs: AnnotationConfig[];
  sourceCode: string;
}) => {
  if (sourceCode.trim().length === 0) {
    return "Source code is required.";
  }
  if (outputConfigs.length === 0) {
    return "At least one output config is required.";
  }
  const outputConfig = outputConfigs[0];
  if ("values" in outputConfig) {
    if (outputConfig.values.length < 2) {
      return "Categorical evaluators require at least two choices.";
    }
    const hasEmptyChoice = outputConfig.values.some(
      (choice) => choice.label.trim().length === 0
    );
    if (hasEmptyChoice) {
      return "Choice labels cannot be empty.";
    }
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

const headerBarCSS = css`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: var(--global-dimension-size-150);
  padding: var(--global-dimension-size-150) var(--global-dimension-size-200);
  border-bottom: 1px solid var(--global-border-color-default);
  flex-shrink: 0;
`;

const headerFieldCSS = css`
  /* Ensure fields don't wrap */
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
`;

const editorSectionCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--global-dimension-size-100);
`;

const sidebarPanelCSS = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
  overflow-y: auto;
  border-left: 1px solid var(--global-border-color-default);
`;

const accordionContentCSS = css`
  padding: var(--global-dimension-size-50) 0;
  padding-bottom: var(--global-dimension-size-150);
`;

const editorContainerCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
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
    background-color: var(--ac-global-color-grey-100);
  }

  & .cm-gutters {
    background-color: var(--ac-global-color-grey-100);
  }

  & .cm-scroller {
    overflow: auto !important;
  }
`;

const choiceGridCSS = css`
  display: grid;
  grid-template-columns: 1fr 100px 32px;
  gap: var(--global-dimension-size-50);
  align-items: center;
`;
