import { useState } from "react";
import type { ModalOverlayProps } from "react-aria-components";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { useRevalidator } from "react-router";
import invariant from "tiny-invariant";

import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/llmEvaluatorDraft";
import type { SandboxConfigOption } from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import { mapSandboxConfigOptions } from "@phoenix/components/evaluators/CodeEvaluatorLanguageSandboxFields";
import {
  extractCodeEvaluatorVariables,
  extractRequiredCodeEvaluatorVariables,
} from "@phoenix/components/evaluators/codeEvaluatorUtils";
import { EditLLMEvaluatorDialogContent } from "@phoenix/components/evaluators/EditLLMEvaluatorDialogContent";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import {
  buildOutputConfigsInput,
  createLLMEvaluatorPayload,
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
import { CodeAuthoringFields } from "@phoenix/pages/project/evaluators/CreateProjectCodeEvaluatorDialogContent";
import { ProjectCodeEvaluatorDialogContent } from "@phoenix/pages/project/evaluators/ProjectCodeEvaluatorDialogContent";
import { ProjectLlmEvaluatorFormSections } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import { convertProjectEvaluatorOutputConfigs } from "@phoenix/pages/project/evaluators/projectEvaluatorOptions";
import { ProjectEvaluatorScopePanel } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import { ProjectEvaluatorSlideover } from "@phoenix/pages/project/evaluators/ProjectEvaluatorSlideover";
import {
  toEvaluationDelayInput,
  toEvaluatorMappingSourceGrain,
  type ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  useEvaluatorFormDirtyCheck,
  type EvaluatorFormDirtyCheck,
} from "@phoenix/pages/project/evaluators/useEvaluatorFormDirtyCheck";
import {
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

/** The slideover heading: the flow, and the evaluator it edits. */
function getEditProjectEvaluatorTitle(evaluator: ProjectEvaluatorNode): string {
  const kind = evaluator.evaluator.kind === "LLM" ? "LLM" : "code";
  return `Edit ${kind} evaluator “${evaluator.name}”`;
}

/**
 * Takes the evaluator already loaded by the route rather than loading it here,
 * so the title is known before the dialog mounts and can name it.
 */
export function EditProjectEvaluatorSlideover({
  evaluator,
  sandboxConfigs,
  ...props
}: {
  evaluator: ProjectEvaluatorNode;
  sandboxConfigs: SandboxConfigOption[];
} & Omit<ModalOverlayProps, "children">) {
  return (
    <ProjectEvaluatorSlideover
      {...props}
      title={getEditProjectEvaluatorTitle(evaluator)}
    >
      {(close, registerDirtyCheck) =>
        evaluator.evaluator.kind === "LLM" ? (
          <EditLlmProjectEvaluator
            evaluator={evaluator}
            onClose={close}
            registerDirtyCheck={registerDirtyCheck}
          />
        ) : (
          <EditCodeProjectEvaluator
            evaluator={evaluator}
            sandboxConfigs={sandboxConfigs}
            onClose={close}
            registerDirtyCheck={registerDirtyCheck}
          />
        )
      }
    </ProjectEvaluatorSlideover>
  );
}

/** Loaded by the edit route, above the slideover. */
export function useProjectEvaluator(projectEvaluatorId: string) {
  const data = useLazyLoadQuery<EditProjectEvaluatorSlideoverQuery>(
    graphql`
      query EditProjectEvaluatorSlideoverQuery($projectEvaluatorId: ID!) {
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
            inputMapping {
              pathMapping
              literalMapping
            }
            project {
              id
            }
            evaluator {
              id
              kind
              name
              description
              ... on LLMEvaluator {
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
    { projectEvaluatorId },
    { fetchPolicy: "network-only" }
  );
  const projectEvaluator = data.projectEvaluator;
  invariant(
    projectEvaluator?.__typename === "ProjectEvaluator",
    "project evaluator is required"
  );
  return {
    evaluator: projectEvaluator,
    sandboxConfigs: mapSandboxConfigOptions(
      data.sandboxProviders,
      data.sandboxBackends
    ),
  };
}

function getScope(evaluator: ProjectEvaluatorNode): ProjectEvaluatorScope {
  return {
    targetType: evaluator.evaluationTarget,
    filterCondition: evaluator.filterCondition,
    samplingRate: evaluator.samplingRate,
    evaluationDelaySeconds: evaluator.evaluationDelaySeconds,
  };
}

function EditLlmProjectEvaluator({
  evaluator,
  onClose,
  registerDirtyCheck,
}: {
  evaluator: ProjectEvaluatorNode;
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
        onClose={onClose}
        registerDirtyCheck={registerDirtyCheck}
      />
    </EvaluatorPlaygroundProvider>
  );
}

function EditLlmProjectEvaluatorContent({
  evaluator,
  onClose,
  registerDirtyCheck,
}: {
  evaluator: ProjectEvaluatorNode;
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
      toEvaluatorMappingSourceGrain(scope.targetType)
    ),
  } satisfies EvaluatorStoreProps;

  const submit = (
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
      return Promise.resolve({ ok: false, error: message });
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
            samplingRate: scope.samplingRate,
            evaluationTarget: scope.targetType,
            filterCondition: scope.filterCondition,
            ...toEvaluationDelayInput(scope),
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
          <EditLLMEvaluatorDialogContent
            title={getEditProjectEvaluatorTitle(evaluator)}
            onClose={onClose}
            onSubmit={() => submit(store)}
            isSubmitting={isUpdating}
            isSubmitDisabled={!isFilterValid}
            mode="update"
            error={error}
            evaluatorNodeId={evaluator.id}
            formLeftPanel={
              <ProjectLlmEvaluatorFormSections
                projectId={evaluator.project.id}
                scope={scope}
                onScopeChange={setScope}
                onFilterValidityChange={setIsFilterValid}
                isTargetDisabled
              />
            }
            formRightPanel={
              <ProjectEvaluatorScopePanel
                projectId={evaluator.project.id}
                scope={scope}
                showScopeFields={false}
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
  sandboxConfigs,
  onClose,
  registerDirtyCheck,
}: {
  evaluator: ProjectEvaluatorNode;
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
  const initialInputMappingJson = JSON.stringify(evaluator.inputMapping);
  const [scope, setScope] = useState(() => getScope(evaluator));
  const [error, setError] = useState<string>();
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
          }
        }
      }
    `);
  const loadedOutputConfigs = convertProjectEvaluatorOutputConfigs(
    evaluator.evaluator.outputConfigs ?? []
  );
  const initialDescription = evaluator.evaluator.description ?? "";
  const initialOutputConfigsJson = JSON.stringify(loadedOutputConfigs);
  const initialState: EvaluatorStoreProps = {
    evaluator: {
      id: evaluator.evaluator.id,
      globalName: evaluator.name,
      name: evaluator.name,
      description: initialDescription,
      inputMapping: evaluator.inputMapping as EvaluatorInputMapping,
      kind: "CODE",
      isBuiltin: false,
      includeExplanation: false,
    },
    outputConfigs: loadedOutputConfigs,
    showPromptPreview: false,
    evaluatorMappingSource: defaultEvaluatorMappingSourceState(
      toEvaluatorMappingSourceGrain(scope.targetType)
    ),
  };
  return (
    <EvaluatorStoreProvider initialState={initialState}>
      {({ store }) => {
        trackStoreForDirtyCheck(store);
        return (
          <ProjectCodeEvaluatorDialogContent
            mode="update"
            title={getEditProjectEvaluatorTitle(evaluator)}
            projectId={evaluator.project.id}
            evaluatorId={evaluator.evaluator.id}
            evaluatorName={evaluator.name}
            variables={variables}
            requiredVariables={requiredVariables}
            codeDefinition={
              <CodeAuthoringFields
                language={language}
                onLanguageChange={() => undefined}
                isLanguageDisabled
                sandboxConfigs={sandboxConfigs}
                selectedSandboxConfigId={sandboxConfigId}
                onSandboxChange={(nextSandboxConfigId) => {
                  setError(undefined);
                  setSandboxConfigId(nextSandboxConfigId);
                }}
                sourceCode={sourceCode}
                onSourceCodeChange={(nextSourceCode) => {
                  setError(undefined);
                  setSourceCode(nextSourceCode);
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
            onSubmit={() => {
              setError(undefined);
              const state = store.getState();
              const inputMappingChanged =
                JSON.stringify(state.evaluator.inputMapping) !==
                initialInputMappingJson;
              const descriptionChanged =
                state.evaluator.description !== initialDescription;
              const outputConfigsChanged =
                JSON.stringify(state.outputConfigs) !==
                initialOutputConfigsJson;
              const sourceCodeChanged = sourceCode !== initialSourceCode;
              const sandboxConfigChanged =
                sandboxConfigId !== initialSandboxConfigId;
              const outputConfigErrors = getOutputConfigValidationErrors(
                state.outputConfigs
              );
              const validationError =
                sourceCode.trim().length === 0
                  ? "Source code is required."
                  : sandboxConfigId == null
                    ? "Please select a sandbox configuration."
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
                    samplingRate: scope.samplingRate,
                    evaluationTarget: scope.targetType,
                    filterCondition: scope.filterCondition,
                    ...toEvaluationDelayInput(scope),
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
