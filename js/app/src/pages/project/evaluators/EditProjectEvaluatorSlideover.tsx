import { Suspense, useRef, useState } from "react";
import type { ModalOverlayProps } from "react-aria-components";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { Dialog, Loading, Modal, ModalOverlay } from "@phoenix/components";
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
import {
  DiscardEvaluatorChangesDialog,
  isModalUnderlay,
} from "@phoenix/pages/project/evaluators/DiscardEvaluatorChangesDialog";
import { ProjectCodeEvaluatorDialogContent } from "@phoenix/pages/project/evaluators/ProjectCodeEvaluatorDialogContent";
import { ProjectEvaluatorFormSections } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import { convertProjectEvaluatorOutputConfigs } from "@phoenix/pages/project/evaluators/projectEvaluatorOptions";
import { ProjectEvaluatorScopePanel } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import {
  fromProjectEvaluatorGraphQLTarget,
  toProjectEvaluatorGraphQLTarget,
  type ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  useEvaluatorFormDirtyCheck,
  type EvaluatorFormDirtyCheck,
} from "@phoenix/pages/project/evaluators/useEvaluatorFormDirtyCheck";
import {
  DEFAULT_LLM_EVALUATOR_STORE_VALUES,
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

export function EditProjectEvaluatorSlideover({
  projectEvaluatorId,
  evaluatorKind,
  ...props
}: {
  projectEvaluatorId: string;
  evaluatorKind: "LLM" | "CODE";
} & ModalOverlayProps) {
  const dirtyCheckRef = useRef<EvaluatorFormDirtyCheck>(() => false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const registerDirtyCheck = (check: EvaluatorFormDirtyCheck) => {
    dirtyCheckRef.current = check;
  };
  return (
    <>
      <ModalOverlay
        {...props}
        isDismissable
        shouldCloseOnInteractOutside={(element) => {
          if (!isModalUnderlay(element)) {
            return false;
          }
          if (dirtyCheckRef.current()) {
            setIsDiscardConfirmOpen(true);
            return false;
          }
          return true;
        }}
      >
        <Modal variant="slideover" size="fullscreen">
          <Dialog aria-label="Edit project evaluator">
            {({ close }) => (
              <Suspense fallback={<Loading />}>
                {evaluatorKind === "LLM" ? (
                  <EditLlmProjectEvaluator
                    projectEvaluatorId={projectEvaluatorId}
                    onClose={close}
                    registerDirtyCheck={registerDirtyCheck}
                  />
                ) : evaluatorKind === "CODE" ? (
                  <EditCodeProjectEvaluator
                    projectEvaluatorId={projectEvaluatorId}
                    onClose={close}
                    registerDirtyCheck={registerDirtyCheck}
                  />
                ) : null}
              </Suspense>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
      <DiscardEvaluatorChangesDialog
        isOpen={isDiscardConfirmOpen}
        onKeepEditing={() => setIsDiscardConfirmOpen(false)}
        onDiscard={() => {
          setIsDiscardConfirmOpen(false);
          props.onOpenChange?.(false);
        }}
      />
    </>
  );
}

function useProjectEvaluator(projectEvaluatorId: string) {
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
    targetType: fromProjectEvaluatorGraphQLTarget(evaluator.evaluationTarget),
    filterCondition: evaluator.filterCondition,
    samplingRate: evaluator.samplingRate,
  };
}

function EditLlmProjectEvaluator({
  projectEvaluatorId,
  onClose,
  registerDirtyCheck,
}: {
  projectEvaluatorId: string;
  onClose: () => void;
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
}) {
  const { evaluator } = useProjectEvaluator(projectEvaluatorId);
  invariant(evaluator.evaluator.kind === "LLM", "expected LLM evaluator");
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
    evaluatorMappingSource: {
      grain: "span" as const,
      source: {
        input: {},
        output: {},
        metadata: { attributes: {} },
      },
    },
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
            evaluationTarget: toProjectEvaluatorGraphQLTarget(scope.targetType),
            filterCondition: scope.filterCondition,
          },
        },
        onCompleted: () => {
          notifySuccess({ title: "Evaluator updated" });
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
            title="Edit project evaluator"
            onClose={onClose}
            onSubmit={() => submit(store)}
            isSubmitting={isUpdating}
            isSubmitDisabled={!isFilterValid}
            mode="update"
            error={error}
            evaluatorNodeId={evaluator.id}
            formLeftPanel={
              <ProjectEvaluatorFormSections definitionKind="llm" />
            }
            formRightPanel={
              <ProjectEvaluatorScopePanel
                projectId={evaluator.project.id}
                scope={scope}
                onScopeChange={setScope}
                onFilterValidityChange={setIsFilterValid}
                showAnnotationTemplate
              />
            }
          />
        );
      }}
    </EvaluatorStoreProvider>
  );
}

function EditCodeProjectEvaluator({
  projectEvaluatorId,
  onClose,
  registerDirtyCheck,
}: {
  projectEvaluatorId: string;
  onClose: () => void;
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
}) {
  const { evaluator, sandboxConfigs } = useProjectEvaluator(projectEvaluatorId);
  invariant(evaluator.evaluator.kind === "CODE", "expected code evaluator");
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
    evaluatorMappingSource: {
      grain: "span",
      source: {
        input: {},
        output: {},
        metadata: { attributes: {} },
      },
    },
  };
  return (
    <EvaluatorStoreProvider initialState={initialState}>
      {({ store }) => {
        trackStoreForDirtyCheck(store);
        return (
          <ProjectCodeEvaluatorDialogContent
            mode="update"
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
                    evaluationTarget: toProjectEvaluatorGraphQLTarget(
                      scope.targetType
                    ),
                    filterCondition: scope.filterCondition,
                  },
                },
                onCompleted: () => {
                  notifySuccess({ title: "Evaluator updated" });
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
