import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { css } from "@emotion/react";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror from "@uiw/react-codemirror";
import { useEffect, useMemo, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import {
  Alert,
  Button,
  ComboBox,
  ComboBoxItem,
  Flex,
  Heading,
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
import { PythonBlock } from "@phoenix/components/code/PythonBlock";
import { TypeScriptBlock } from "@phoenix/components/code/TypeScriptBlock";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
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

export type SandboxConfigOption = {
  id: number;
  name: string;
  description?: string | null;
  providerLabel: string;
  providerLanguage: CodeEvaluatorLanguage;
};

export const EditCodeEvaluatorDialogContent = ({
  onSubmit,
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
    sandboxConfigId: number | null;
  }) => void;
  isSubmitting: boolean;
  mode: "create" | "update";
  error?: string;
  initialLanguage: CodeEvaluatorLanguage;
  initialSourceCode: string;
  sandboxConfigs: SandboxConfigOption[];
  initialSandboxConfigId?: number | null;
}) => {
  const store = useEvaluatorStoreInstance();
  const [showValidationError, setShowValidationError] = useState(false);
  const [sourceCode, setSourceCode] = useState(initialSourceCode);
  const [language, setLanguage] =
    useState<CodeEvaluatorLanguage>(initialLanguage);
  const [sandboxConfigId, setSandboxConfigId] = useState<number | null>(
    initialSandboxConfigId ?? null
  );
  const [localValidationError, setLocalValidationError] = useState<
    string | undefined
  >();
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
    onSubmit({
      language,
      sourceCode,
      sandboxConfigId: selectedSandboxConfigId,
    });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Create Evaluator" : "Edit Evaluator"}
        </DialogTitle>
        <DialogTitleExtra>
          <Button slot="close" isDisabled={isSubmitting}>
            Cancel
          </Button>
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
        <CodeEvaluatorInputVariablesProvider variables={variables}>
          <Group orientation="horizontal" style={{ flex: 1, minHeight: 0 }}>
            <Panel defaultSize={55} style={panelStyle} css={leftPanelCSS}>
              <View marginBottom="size-200" flex="none">
                <Flex
                  direction="row"
                  alignItems="baseline"
                  width="100%"
                  gap="size-100"
                >
                  <EvaluatorNameInput />
                  <EvaluatorDescriptionInput />
                </Flex>
              </View>
              <CodeEvaluatorLanguageField
                language={language}
                onChange={(nextLanguage) => {
                  setLanguage((currentLanguage) => {
                    if (
                      sourceCode ===
                      DEFAULT_CODE_EVALUATOR_SOURCE[currentLanguage]
                    ) {
                      setSourceCode(
                        DEFAULT_CODE_EVALUATOR_SOURCE[nextLanguage]
                      );
                    }
                    return nextLanguage;
                  });
                }}
              />
              <CodeEvaluatorSandboxField
                sandboxConfigs={compatibleSandboxConfigs}
                selectedSandboxConfigId={selectedSandboxConfigId}
                onSelectionChange={setSandboxConfigId}
              />
              <CodeEvaluatorSourceEditor
                language={language}
                sourceCode={sourceCode}
                onChange={setSourceCode}
              />
              <CodeEvaluatorOutputConfigSection />
              <Flex direction="column" gap="size-100">
                <Heading level={2} weight="heavy">
                  Map Evaluator Inputs
                </Heading>
                <Text color="text-500">
                  Map the arguments used by your evaluator to fields from a
                  dataset example. For TypeScript evaluators, variables are
                  inferred from the object keys used in the{" "}
                  <code>evaluate</code> function.
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
            </Panel>
            <Separator css={compactResizeHandleCSS} />
            <Panel defaultSize={45} style={panelStyle} css={rightPanelCSS}>
              <Flex direction="column" gap="size-200">
                <View paddingX="size-200">
                  <Flex direction="column" gap="size-100">
                    <EvaluatorExampleDataset />
                  </Flex>
                </View>
                <EvaluatorInputPreview />
              </Flex>
            </Panel>
          </Group>
        </CodeEvaluatorInputVariablesProvider>
      </fieldset>
    </DialogContent>
  );
};

const CodeEvaluatorLanguageField = ({
  language,
  onChange,
}: {
  language: CodeEvaluatorLanguage;
  onChange: (language: CodeEvaluatorLanguage) => void;
}) => {
  return (
    <View marginBottom="size-200" flex="none">
      <Select
        value={language}
        onChange={(value) => onChange(value as CodeEvaluatorLanguage)}
      >
        <Label>Language</Label>
        <Button>
          <SelectValue />
          <SelectChevronUpDownIcon />
        </Button>
        <Popover>
          <ListBox>
            <SelectItem id="PYTHON">Python</SelectItem>
            <SelectItem id="TYPESCRIPT">TypeScript</SelectItem>
          </ListBox>
        </Popover>
      </Select>
    </View>
  );
};

const CodeEvaluatorSourceEditor = ({
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
  const extensions = useMemo(
    () =>
      language === "PYTHON" ? [python()] : [javascript({ typescript: true })],
    [language]
  );
  return (
    <Flex direction="column" gap="size-100" marginBottom="size-200">
      <Heading level={2} weight="heavy">
        Evaluator Code
      </Heading>
      <Flex direction="row" justifyContent="space-between" alignItems="center">
        <Text color="text-500">
          Define an <code>evaluate</code> function that returns either a numeric
          score or a categorical label.
        </Text>
        <Button
          size="S"
          variant="default"
          onPress={() => onChange(DEFAULT_CODE_EVALUATOR_SOURCE[language])}
        >
          <Icon svg={<Icons.Refresh />} />
          Reset to default
        </Button>
      </Flex>
      <div
        css={editorWrapCSS}
        onKeyDown={(e) => {
          // Prevent Escape from propagating to the modal overlay,
          // which would close the slideover and discard edits.
          if (e.key === "Escape") {
            e.stopPropagation();
          }
        }}
      >
        <CodeMirror
          value={sourceCode}
          onChange={onChange}
          theme={codeMirrorTheme}
          extensions={extensions}
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
    </Flex>
  );
};

const CodeEvaluatorOutputConfigSection = () => {
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
    <Flex direction="column" gap="size-100" marginBottom="size-200">
      <Heading level={2} weight="heavy">
        Evaluator Annotation
      </Heading>
      <Text color="text-500">
        Configure the annotation produced by this evaluator.
      </Text>
      <View
        borderRadius="medium"
        borderWidth="thin"
        borderColor="default"
        padding="size-200"
      >
        <Flex direction="column" gap="size-150">
          <Select
            value={outputType}
            onChange={(value) => {
              const nextType =
                value as (typeof outputTypeOptions)[number]["id"];
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
          <TextField isDisabled value={outputConfig.name}>
            <Label>Name</Label>
            <Input />
          </TextField>
          <OptimizationDirectionField />
          {"values" in outputConfig ? (
            <CategoricalChoicesEditor values={outputConfig.values} />
          ) : (
            <ContinuousBoundsEditor config={outputConfig} />
          )}
        </Flex>
      </View>
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
      <Text weight="heavy" size="S">
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
            isDisabled={values.length <= 2}
            onPress={() => {
              if (values.length <= 2) {
                return;
              }
              updateValues(
                values.filter((_, valueIndex) => valueIndex !== index)
              );
            }}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="quiet"
        onPress={() => {
          updateValues([...values, { label: "", score: undefined }]);
        }}
      >
        Add choice
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
    <div css={choiceGridCSS}>
      <TextField
        value={config.lowerBound != null ? String(config.lowerBound) : ""}
        onChange={(value) => {
          updateConfig({
            lowerBound: value.trim() === "" ? null : Number(value),
          });
        }}
      >
        <Label>Lower bound</Label>
        <Input type="number" placeholder="Optional" />
      </TextField>
      <TextField
        value={config.upperBound != null ? String(config.upperBound) : ""}
        onChange={(value) => {
          updateConfig({
            upperBound: value.trim() === "" ? null : Number(value),
          });
        }}
      >
        <Label>Upper bound</Label>
        <Input type="number" placeholder="Optional" />
      </TextField>
      <View />
    </div>
  );
};

export const CodeEvaluatorSourceCodeBlock = ({
  language,
  sourceCode,
}: {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
}) => {
  if (language === "PYTHON") {
    return <PythonBlock value={sourceCode} />;
  }
  return <TypeScriptBlock value={sourceCode} />;
};

const CodeEvaluatorSandboxField = ({
  sandboxConfigs,
  selectedSandboxConfigId,
  onSelectionChange,
}: {
  sandboxConfigs: SandboxConfigOption[];
  selectedSandboxConfigId: number | null;
  onSelectionChange: (sandboxConfigId: number | null) => void;
}) => {
  return (
    <View marginBottom="size-200" flex="none">
      <ComboBox
        label="Sandbox config"
        size="L"
        placeholder={
          sandboxConfigs.length > 0
            ? "Select a sandbox config"
            : "No sandbox configs available"
        }
        selectedKey={
          selectedSandboxConfigId != null
            ? String(selectedSandboxConfigId)
            : null
        }
        onSelectionChange={(key) => {
          if (typeof key === "string") {
            onSelectionChange(Number(key));
          } else {
            onSelectionChange(null);
          }
        }}
        defaultItems={sandboxConfigs}
        menuTrigger="focus"
        isDisabled={sandboxConfigs.length === 0}
        renderEmptyState={() => (
          <div>No sandbox configs found for this language</div>
        )}
      >
        {(item) => (
          <ComboBoxItem
            id={String(item.id)}
            key={item.id}
            textValue={item.name}
          >
            <Flex direction="column" gap="size-25">
              <Text>{item.name}</Text>
              {item.description ? (
                <Text color="text-700" size="S">
                  {item.description}
                </Text>
              ) : (
                <Text color="text-700" size="S">
                  {item.providerLabel}
                </Text>
              )}
            </Flex>
          </ComboBoxItem>
        )}
      </ComboBox>
      <Text color="text-500" size="S">
        Code evaluators run in a sandbox. Configure reusable sandbox configs in
        Settings if none are available here.
      </Text>
    </View>
  );
};

export const mapSandboxConfigOptions = (
  sandboxProviders: ReadonlyArray<{
    language: CodeEvaluatorLanguage;
    backendType: string;
    configs: ReadonlyArray<{
      id: string;
      name: string;
      description?: string | null;
    }>;
  }>
): SandboxConfigOption[] => {
  return sandboxProviders.flatMap((provider) =>
    provider.configs.map((config) => ({
      id: decodeRelayNodeId(config.id),
      name: config.name,
      description: config.description,
      providerLanguage: provider.language,
      providerLabel: backendTypeLabel(provider.backendType),
    }))
  );
};

const BACKEND_TYPE_LABELS: Record<string, string> = {
  WASM: "WebAssembly",
  E2B: "E2B",
  DAYTONA_PYTHON: "Daytona",
  VERCEL_PYTHON: "Vercel",
  VERCEL_TYPESCRIPT: "Vercel",
  DENO: "Deno",
  MODAL: "Modal",
};

const backendTypeLabel = (backendType: string): string =>
  BACKEND_TYPE_LABELS[backendType] ?? backendType;

const decodeRelayNodeId = (globalId: string) => {
  const decoded = globalThis.atob(globalId);
  const [, rawId = ""] = decoded.split(":", 2);
  return Number(rawId);
};

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

const fieldsetCSS = css`
  all: unset;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--global-dimension-size-200);
  overflow: auto;
`;

const panelStyle = {
  height: "100%",
  overflowY: "auto",
} as const;

const leftPanelCSS = css`
  display: flex;
  flex-direction: column;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  box-sizing: border-box;
  gap: var(--global-dimension-size-100);
`;

const rightPanelCSS = css`
  display: flex;
  flex-direction: column;
  padding: var(--global-dimension-size-100) 0;
  box-sizing: border-box;
`;

const editorWrapCSS = css`
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  overflow: hidden;

  & .cm-editor {
    min-height: 280px;
  }

  & .cm-content,
  & .cm-gutter {
    min-height: 280px;
  }
`;

const choiceGridCSS = css`
  display: grid;
  grid-template-columns: 1.5fr 1fr auto;
  gap: var(--global-dimension-size-100);
  align-items: end;
`;
