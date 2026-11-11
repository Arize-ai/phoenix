import { useState } from "react";
import type { ModalOverlayProps } from "react-aria-components";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { useRevalidator } from "react-router";
import invariant from "tiny-invariant";

import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { CodeAuthoringFields } from "@phoenix/components/evaluators/CodeAuthoringFields";
import type { SandboxConfigOption } from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import { mapSandboxConfigOptions } from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import {
  extractCodeEvaluatorVariables,
  extractRequiredCodeEvaluatorVariables,
} from "@phoenix/components/evaluators/codeEvaluatorUtils";
import { readDecisionEvaluatorData } from "@phoenix/components/evaluators/decision/decisionEvaluatorUtils";
import { useLLMEvaluatorVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useLLMEvaluatorVariables";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import {
  buildInputSchemaInput,
  buildOutputConfigsInput,
  createLLMEvaluatorPayload,
  getInputDescriptionsFromSchema,
  getOutputConfigValidationErrors,
  inferIncludeExplanationFromPrompt,
} from "@phoenix/components/evaluators/utils";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import type { EditProjectEvaluatorSlideoverQuery } from "@phoenix/pages/project/evaluators/__generated__/EditProjectEvaluatorSlideoverQuery.graphql";
import type { EditProjectEvaluatorSlideoverUpdateCodeMutation } from "@phoenix/pages/project/evaluators/__generated__/EditProjectEvaluatorSlideoverUpdateCodeMutation.graphql";
import type { EditProjectEvaluatorSlideoverUpdateLlmMutation } from "@phoenix/pages/project/evaluators/__generated__/EditProjectEvaluatorSlideoverUpdateLlmMutation.graphql";
import { ProjectCodeEvaluatorDialogContent } from "@phoenix/pages/project/evaluators/ProjectCodeEvaluatorDialogContent";
import { EditProjectDecisionEvaluatorDialogContent } from "@phoenix/pages/project/evaluators/ProjectDecisionEvaluatorDialogContent";
import {
  ProjectEvaluatorInputMappingDock,
  ProjectLlmEvaluatorFormSections,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import { convertProjectEvaluatorOutputConfigs } from "@phoenix/pages/project/evaluators/projectEvaluatorOptions";
import { ProjectEvaluatorScopePanel } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import { ProjectEvaluatorSlideover } from "@phoenix/pages/project/evaluators/ProjectEvaluatorSlideover";
import {
  isSameInputMapping,
  toEvaluationDelayInput,
  toEvaluatorRecordKind,
  type ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { ProjectLlmEvaluatorDialogContent } from "@phoenix/pages/project/evaluators/ProjectLlmEvaluatorDialogContent";
import {
  useEvaluatorFormDirtyCheck,
  type EvaluatorFormDirtyCheck,
} from "@phoenix/pages/project/evaluators/useEvaluatorFormDirtyCheck";
import {
  DEFAULT_DECISION_EVALUATOR_STORE_VALUES,
  DEFAULT_LLM_EVALUATOR_STORE_VALUES,
  defaultEvaluatorMappingSourceState,
  type EvaluatorStoreInstance,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";
import type {
  CodeEvaluatorLanguage,
  EvaluatorInputMapping,
} from "@phoenix/types";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

type ProjectEvaluatorNode = Extract<
  NonNullable<
    EditProjectEvaluatorSlideoverQuery["response"]["projectEvaluator"]
  >,
  { readonly __typename: "ProjectEvaluator" }
>;

type EditableProjectEvaluatorKind = "LLM" | "CODE" | "DECISION";

/** The slideover heading: the flow, and the evaluator it edits. */
function getEditProjectEvaluatorTitle({
  kind,
  name,
}: {
  kind: EditableProjectEvaluatorKind;
  name: string;
}): string {
  const kindLabel =
    kind === "LLM" ? "LLM" : kind === "DECISION" ? "decision" : "code";
  return `Edit ${kindLabel} evaluator “${name}”`;
}

/** Opens at once; the form loads under the slideover's loading state. */
export function EditProjectEvaluatorSlideover({
  projectEvaluatorId,
  kind,
  name,
  ...props
}: {
  projectEvaluatorId: string;
  kind: EditableProjectEvaluatorKind;
  name: string;
} & Omit<ModalOverlayProps, "children">) {
  const title = getEditProjectEvaluatorTitle({ kind, name });
  return (
    <ProjectEvaluatorSlideover {...props} title={title}>
      {(close, registerDirtyCheck) => (
        <EditProjectEvaluatorForm
          projectEvaluatorId={projectEvaluatorId}
          kind={kind}
          title={title}
          onClose={close}
          registerDirtyCheck={registerDirtyCheck}
        />
      )}
    </ProjectEvaluatorSlideover>
  );
}

function EditProjectEvaluatorForm({
  projectEvaluatorId,
  kind,
  title,
  onClose,
  registerDirtyCheck,
}: {
  projectEvaluatorId: string;
  kind: EditableProjectEvaluatorKind;
  title: string;
  onClose: () => void;
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
}) {
  const data = useLazyLoadQuery<EditProjectEvaluatorSlideoverQuery>(
    graphql`
      query EditProjectEvaluatorSlideoverQuery(
        $projectEvaluatorId: ID!
        $includeSandboxes: Boolean!
      ) {
        projectEvaluator: node(id: $projectEvaluatorId) {
          __typename
          ... on ProjectEvaluator {
            id
            name
            evaluationTarget
            filterCondition
            samplingRate
            evaluationDelaySeconds
            enabled
            tracingEnabled
            inputMapping {
              pathMapping
              literalMapping
            }
            project {
              id
            }
            evaluator {
              __typename
              id
              kind
              name
              description
              ... on DecisionEvaluator {
                ...decisionEvaluatorFragment_evaluator @relay(mask: false)
              }
              ... on LLMEvaluator {
                llmInputSchema: inputSchema
                outputConfigs {
                  __typename
                  ... on CategoricalAnnotationConfig {
                    name
                    optimizationDirection
                    values {
                      label
                      score
                    }
                  }
                  ... on ContinuousAnnotationConfig {
                    name
                    optimizationDirection
                    lowerBound
                    upperBound
                  }
                  ... on FreeformAnnotationConfig {
                    name
                    optimizationDirection
                    threshold
                    lowerBound
                    upperBound
                  }
                }
                prompt {
                  id
                  name
                }
                promptVersionTag {
                  name
                }
                promptVersion {
                  templateFormat
                  tools {
                    tools {
                      __typename
                      ... on PromptToolFunction {
                        function {
                          parameters
                        }
                      }
                      ... on PromptToolRaw {
                        raw
                      }
                    }
                  }
                  ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
                }
              }
              ... on CodeEvaluator {
                codeInputSchema: inputSchema
                sourceCode
                language
                sandboxConfig {
                  id
                }
                inputMapping {
                  pathMapping
                  literalMapping
                }
                outputConfigs {
                  __typename
                  ... on CategoricalAnnotationConfig {
                    name
                    optimizationDirection
                    values {
                      label
                      score
                    }
                  }
                  ... on ContinuousAnnotationConfig {
                    name
                    optimizationDirection
                    lowerBound
                    upperBound
                  }
                  ... on FreeformAnnotationConfig {
                    name
                    optimizationDirection
                    threshold
                    lowerBound
                    upperBound
                  }
                }
              }
            }
          }
        }
        sandboxProviders @include(if: $includeSandboxes) {
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
        sandboxBackends @include(if: $includeSandboxes) {
          backendType
          status
          supportsEnvVars
          internetAccess
          supportsDependencies
        }
      }
    `,
    { projectEvaluatorId, includeSandboxes: kind === "CODE" },
    { fetchPolicy: "network-only" }
  );
  const evaluator = data.projectEvaluator;
  invariant(
    evaluator?.__typename === "ProjectEvaluator",
    "project evaluator is required"
  );
  if (kind === "LLM") {
    return (
      <EditLlmProjectEvaluator
        evaluator={evaluator}
        title={title}
        onClose={onClose}
        registerDirtyCheck={registerDirtyCheck}
      />
    );
  }
  if (kind === "DECISION") {
    return (
      <EditDecisionProjectEvaluator
        evaluator={evaluator}
        title={title}
        onClose={onClose}
        registerDirtyCheck={registerDirtyCheck}
      />
    );
  }
  return (
    <EditCodeProjectEvaluator
      evaluator={evaluator}
      title={title}
      sandboxConfigs={mapSandboxConfigOptions(
        data.sandboxProviders ?? [],
        data.sandboxBackends ?? []
      )}
      onClose={onClose}
      registerDirtyCheck={registerDirtyCheck}
    />
  );
}

function getScope(evaluator: ProjectEvaluatorNode): ProjectEvaluatorScope {
  return {
    targetType: evaluator.evaluationTarget,
    filterCondition: evaluator.filterCondition,
    samplingRate: evaluator.samplingRate,
    evaluationDelaySeconds: evaluator.evaluationDelaySeconds,
    tracingEnabled: evaluator.tracingEnabled,
  };
}

function EditDecisionProjectEvaluator({
  evaluator,
  title,
  onClose,
  registerDirtyCheck,
}: {
  evaluator: ProjectEvaluatorNode;
  title: string;
  onClose: () => void;
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
}) {
  const decisionEvaluator = readDecisionEvaluatorData(evaluator.evaluator);
  invariant(decisionEvaluator, "a decision evaluator is required");
  const [scope, setScope] = useState(() => getScope(evaluator));
  const [initialState] = useState(
    () =>
      ({
        ...DEFAULT_DECISION_EVALUATOR_STORE_VALUES,
        evaluator: {
          ...DEFAULT_DECISION_EVALUATOR_STORE_VALUES.evaluator,
          id: evaluator.evaluator.id,
          globalName: evaluator.name,
          description: evaluator.evaluator.description ?? "",
          inputMapping: evaluator.inputMapping as EvaluatorInputMapping,
        },
        evaluatorMappingSource: defaultEvaluatorMappingSourceState(
          toEvaluatorRecordKind(evaluator.evaluationTarget)
        ),
      }) satisfies EvaluatorStoreProps
  );
  return (
    <EvaluatorStoreProvider initialState={initialState}>
      <EditProjectDecisionEvaluatorDialogContent
        title={title}
        projectId={evaluator.project.id}
        projectEvaluatorId={evaluator.id}
        evaluator={decisionEvaluator}
        scope={scope}
        onScopeChange={setScope}
        onSuccess={onClose}
        onClose={onClose}
        registerDirtyCheck={registerDirtyCheck}
      />
    </EvaluatorStoreProvider>
  );
}

function EditLlmProjectEvaluator({
  evaluator,
  title,
  onClose,
  registerDirtyCheck,
}: {
  evaluator: ProjectEvaluatorNode;
  title: string;
  onClose: () => void;
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
}) {
  return (
    <EvaluatorPlaygroundProvider
      promptId={evaluator.evaluator.prompt?.id}
      promptName={evaluator.evaluator.prompt?.name}
      promptVersionRef={evaluator.evaluator.promptVersion}
      promptVersionTag={evaluator.evaluator.promptVersionTag?.name}
      templateFormat={evaluator.evaluator.promptVersion?.templateFormat}
    >
      <EditLlmProjectEvaluatorContent
        evaluator={evaluator}
        title={title}
        onClose={onClose}
        registerDirtyCheck={registerDirtyCheck}
      />
    </EvaluatorPlaygroundProvider>
  );
}

function EditLlmProjectEvaluatorContent({
  evaluator,
  title,
  onClose,
  registerDirtyCheck,
}: {
  evaluator: ProjectEvaluatorNode;
  title: string;
  onClose: () => void;
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
}) {
  const notifySuccess = useNotifySuccess();
  // The mutation payload carries only the scope scalars; the details page
  // beneath this slideover also renders the prompt and output configs, so
  // re-run its loader once the save lands.
  const { revalidate } = useRevalidator();
  const playgroundStore = usePlaygroundStore();
  const instanceId = usePlaygroundContext((state) => state.instances[0].id);
  invariant(instanceId != null, "instanceId is required");
  // The same names the mapping rows show, so an f-string `{reference.label}`
  // sends its description under `reference`.
  const variables = useLLMEvaluatorVariables({ instanceId });
  const [error, setError] = useState<string>();
  const [scope, setScope] = useState(() => getScope(evaluator));
  const [isFilterValid, setIsFilterValid] = useState(true);
  const trackStoreForDirtyCheck = useEvaluatorFormDirtyCheck({
    registerDirtyCheck,
    scope,
    playgroundStore,
  });
  const [commitUpdate, isUpdating] =
    useMutation<EditProjectEvaluatorSlideoverUpdateLlmMutation>(graphql`
      mutation EditProjectEvaluatorSlideoverUpdateLlmMutation(
        $input: UpdateProjectLLMEvaluatorInput!
      ) {
        updateProjectLlmEvaluator(input: $input) {
          evaluator {
            id
            name
            evaluationTarget
            filterCondition
            samplingRate
            enabled
            tracingEnabled
          }
        }
      }
    `);
  const outputConfigs = convertProjectEvaluatorOutputConfigs(
    evaluator.evaluator.outputConfigs ?? []
  );
  const initialState = {
    ...DEFAULT_LLM_EVALUATOR_STORE_VALUES,
    evaluator: {
      ...DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator,
      id: evaluator.evaluator.id,
      globalName: evaluator.name,
      description: evaluator.evaluator.description ?? "",
      kind: "LLM" as const,
      inputMapping: evaluator.inputMapping as EvaluatorInputMapping,
      inputDescriptions: getInputDescriptionsFromSchema(
        evaluator.evaluator.llmInputSchema
      ),
      includeExplanation: inferIncludeExplanationFromPrompt(
        evaluator.evaluator.promptVersion?.tools
      ),
    },
    outputConfigs: outputConfigs.length
      ? outputConfigs
      : DEFAULT_LLM_EVALUATOR_STORE_VALUES.outputConfigs,
    // The persisted target decides the mapping vocabulary before any recorded
    // record loads; a session evaluator must never open speaking span.
    evaluatorMappingSource: defaultEvaluatorMappingSourceState(
      toEvaluatorRecordKind(scope.targetType)
    ),
  } satisfies EvaluatorStoreProps;

  const submit = async (
    store: EvaluatorStoreInstance
  ): Promise<EvaluatorSubmitResult> => {
    setError(undefined);
    const state = store.getState();
    const validationErrors = getOutputConfigValidationErrors(
      state.outputConfigs
    );
    if (validationErrors.length) {
      const message = validationErrors.join("\n");
      setError(message);
      return { ok: false, error: message };
    }
    const payload = createLLMEvaluatorPayload({
      playgroundStore,
      instanceId,
      name: state.evaluator.globalName,
      description: state.evaluator.description,
      outputConfigs: state.outputConfigs,
      inputMapping: state.evaluator.inputMapping,
      includeExplanation: state.evaluator.includeExplanation,
      datasetId: "",
    });
    const { datasetId: _datasetId, ...llmInput } = payload;
    return new Promise((resolve) =>
      commitUpdate({
        variables: {
          input: {
            ...llmInput,
            projectEvaluatorId: evaluator.id,
            inputMapping: state.evaluator.inputMapping,
            inputSchema: buildInputSchemaInput({
              variables,
              inputDescriptions: state.evaluator.inputDescriptions,
            }),
            samplingRate: scope.samplingRate,
            evaluationTarget: scope.targetType,
            filterCondition: scope.filterCondition,
            ...toEvaluationDelayInput(scope),
            tracingEnabled: scope.tracingEnabled,
          },
        },
        onCompleted: () => {
          notifySuccess({ title: "Evaluator updated" });
          void revalidate();
          onClose();
          resolve({
            ok: true,
            acceptedBy: "user",
            evaluator: { id: evaluator.id, name: state.evaluator.globalName },
          });
        },
        onError: (mutationError) => {
          const message =
            getErrorMessagesFromRelayMutationError(mutationError)?.join("\n") ??
            mutationError.message;
          setError(message);
          resolve({ ok: false, error: message });
        },
      })
    );
  };
  return (
    <EvaluatorStoreProvider initialState={initialState}>
      {({ store }) => {
        trackStoreForDirtyCheck(store);
        return (
          <ProjectLlmEvaluatorDialogContent
            targetType={scope.targetType}
            isFilterValid={isFilterValid}
            title={title}
            onClose={onClose}
            onSubmit={() => submit(store)}
            isSubmitting={isUpdating}
            mode="update"
            error={error}
            llmEvaluatorNodeId={evaluator.evaluator.id}
            formLeftPanel={
              <ProjectLlmEvaluatorFormSections
                projectId={evaluator.project.id}
                scope={scope}
                onScopeChange={setScope}
                onFilterValidityChange={setIsFilterValid}
                isTargetDisabled
              />
            }
            formLeftDock={
              <ProjectEvaluatorInputMappingDock
                recordKind={toEvaluatorRecordKind(scope.targetType)}
                evaluatorKind="prompt"
              />
            }
            formRightPanel={
              <ProjectEvaluatorScopePanel
                projectId={evaluator.project.id}
                scope={scope}
              />
            }
          />
        );
      }}
    </EvaluatorStoreProvider>
  );
}

function EditCodeProjectEvaluator({
  evaluator,
  title,
  sandboxConfigs,
  onClose,
  registerDirtyCheck,
}: {
  evaluator: ProjectEvaluatorNode;
  title: string;
  sandboxConfigs: SandboxConfigOption[];
  onClose: () => void;
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
}) {
  const language = evaluator.evaluator.language as CodeEvaluatorLanguage;
  const initialSourceCode = evaluator.evaluator.sourceCode ?? "";
  const initialSandboxConfigId = evaluator.evaluator.sandboxConfig?.id ?? null;
  const [sourceCode, setSourceCode] = useState(initialSourceCode);
  const [sandboxConfigId, setSandboxConfigId] = useState(
    initialSandboxConfigId
  );
  const variables = extractCodeEvaluatorVariables({ language, sourceCode });
  const requiredVariables = extractRequiredCodeEvaluatorVariables({
    language,
    sourceCode,
  });
  // The update mutation treats an omitted inputMapping as "preserve", so
  // snapshot the stored value to tell an edit from an inherited setting.
  const initialInputMapping = evaluator.inputMapping as EvaluatorInputMapping;
  const [scope, setScope] = useState(() => getScope(evaluator));
  const [error, setError] = useState<string>();
  const clearError = () => setError(undefined);
  // See the LLM edit path: the details page loader must re-run after a save.
  const { revalidate } = useRevalidator();
  const trackStoreForDirtyCheck = useEvaluatorFormDirtyCheck({
    registerDirtyCheck,
    scope,
    localState: { sourceCode, sandboxConfigId },
  });
  const notifySuccess = useNotifySuccess();
  const [commitUpdate, isUpdating] =
    useMutation<EditProjectEvaluatorSlideoverUpdateCodeMutation>(graphql`
      mutation EditProjectEvaluatorSlideoverUpdateCodeMutation(
        $input: UpdateProjectCodeEvaluatorInput!
      ) {
        updateProjectCodeEvaluator(input: $input) {
          evaluator {
            id
            name
            evaluationTarget
            filterCondition
            samplingRate
            enabled
            tracingEnabled
          }
        }
      }
    `);
  const loadedOutputConfigs = convertProjectEvaluatorOutputConfigs(
    evaluator.evaluator.outputConfigs ?? []
  );
  const initialDescription = evaluator.evaluator.description ?? "";
  const initialOutputConfigsJson = JSON.stringify(loadedOutputConfigs);
  const initialInputDescriptions = getInputDescriptionsFromSchema(
    evaluator.evaluator.codeInputSchema
  );
  const initialState: EvaluatorStoreProps = {
    evaluator: {
      id: evaluator.evaluator.id,
      globalName: evaluator.name,
      name: evaluator.name,
      description: initialDescription,
      inputMapping: evaluator.inputMapping as EvaluatorInputMapping,
      inputDescriptions: initialInputDescriptions,
      kind: "CODE",
      isBuiltin: false,
      includeExplanation: false,
    },
    outputConfigs: loadedOutputConfigs,
    showPromptPreview: false,
    evaluatorMappingSource: defaultEvaluatorMappingSourceState(
      toEvaluatorRecordKind(scope.targetType)
    ),
  };
  return (
    <EvaluatorStoreProvider initialState={initialState}>
      {({ store }) => {
        trackStoreForDirtyCheck(store);
        return (
          <ProjectCodeEvaluatorDialogContent
            mode="update"
            title={title}
            projectId={evaluator.project.id}
            evaluatorId={evaluator.evaluator.id}
            evaluatorName={evaluator.name}
            variables={variables}
            requiredVariables={requiredVariables}
            codeDefinition={
              <CodeAuthoringFields
                language={language}
                isLanguageDisabled
                sandboxConfigs={sandboxConfigs}
                selectedSandboxConfigId={sandboxConfigId}
                onSandboxChange={setSandboxConfigId}
                sourceCode={sourceCode}
                onSourceCodeChange={setSourceCode}
                onFieldChange={clearError}
                resetSource={{
                  language,
                  sourceCode: initialSourceCode,
                  kind: "saved",
                }}
              />
            }
            inlineCode={{
              language,
              sourceCode,
              sandboxConfigId,
            }}
            scope={scope}
            onScopeChange={setScope}
            isSubmitting={isUpdating}
            error={error}
            onFieldChange={clearError}
            onSubmit={() => {
              setError(undefined);
              const state = store.getState();
              const inputMappingChanged = !isSameInputMapping(
                state.evaluator.inputMapping,
                initialInputMapping
              );
              const descriptionChanged =
                state.evaluator.description !== initialDescription;
              const outputConfigsChanged =
                JSON.stringify(state.outputConfigs) !==
                initialOutputConfigsJson;
              const sourceCodeChanged = sourceCode !== initialSourceCode;
              const sandboxConfigChanged =
                sandboxConfigId !== initialSandboxConfigId;
              // The update treats an omitted inputSchema as "keep", so it is
              // sent only when a description of a declared parameter changed.
              const inputSchema = buildInputSchemaInput({
                variables,
                inputDescriptions: state.evaluator.inputDescriptions,
              });
              const inputSchemaChanged =
                JSON.stringify(inputSchema) !==
                JSON.stringify(
                  buildInputSchemaInput({
                    variables,
                    inputDescriptions: initialInputDescriptions,
                  })
                );
              const outputConfigErrors = getOutputConfigValidationErrors(
                state.outputConfigs
              );
              const validationError =
                sourceCode.trim().length === 0
                  ? "Source code is required."
                  : sandboxConfigId == null
                    ? "Sandbox configuration is required."
                    : outputConfigErrors.length
                      ? outputConfigErrors.join("\n")
                      : undefined;
              if (validationError) {
                setError(validationError);
                return;
              }
              commitUpdate({
                variables: {
                  input: {
                    projectEvaluatorId: evaluator.id,
                    name: state.evaluator.globalName,
                    ...(descriptionChanged
                      ? {
                          description:
                            state.evaluator.description.trim() || null,
                        }
                      : {}),
                    ...(sourceCodeChanged ? { sourceCode } : {}),
                    ...(sandboxConfigChanged ? { sandboxConfigId } : {}),
                    ...(outputConfigsChanged
                      ? {
                          outputConfigs: buildOutputConfigsInput(
                            state.outputConfigs
                          ),
                        }
                      : {}),
                    ...(inputMappingChanged
                      ? { inputMapping: state.evaluator.inputMapping }
                      : {}),
                    ...(inputSchemaChanged ? { inputSchema } : {}),
                    samplingRate: scope.samplingRate,
                    evaluationTarget: scope.targetType,
                    filterCondition: scope.filterCondition,
                    ...toEvaluationDelayInput(scope),
                    tracingEnabled: scope.tracingEnabled,
                  },
                },
                onCompleted: () => {
                  notifySuccess({ title: "Evaluator updated" });
                  void revalidate();
                  onClose();
                },
                onError: (mutationError) =>
                  setError(
                    getErrorMessagesFromRelayMutationError(mutationError)?.join(
                      "\n"
                    ) ?? mutationError.message
                  ),
              });
            }}
          />
        );
      }}
    </EvaluatorStoreProvider>
  );
}
