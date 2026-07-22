import { Suspense, useState } from "react";
import type { Key, ModalOverlayProps } from "react-aria-components";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { Dialog, Loading, Modal, ModalOverlay } from "@phoenix/components";
import { extractCodeEvaluatorVariables } from "@phoenix/components/evaluators/codeEvaluatorUtils";
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
import { ProjectCodeEvaluatorDialogContent } from "@phoenix/pages/project/evaluators/ProjectCodeEvaluatorDialogContent";
import { ProjectEvaluatorFormSections } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import { ProjectEvaluatorTestPanel } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTestPanel";
import {
  fromProjectEvaluatorGraphQLTarget,
  toProjectEvaluatorGraphQLTarget,
  toProjectEvaluatorSamplingFraction,
  type ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  DEFAULT_LLM_EVALUATOR_STORE_VALUES,
  type AnnotationConfig,
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

type ProjectEvaluatorOutputConfig = NonNullable<
  ProjectEvaluatorNode["evaluator"]["outputConfigs"]
>[number];

export function EditProjectEvaluatorSlideover({
  projectEvaluatorId,
  evaluatorKind,
  ...props
}: {
  projectEvaluatorId: string;
  evaluatorKind: "LLM" | "CODE";
} & ModalOverlayProps) {
  return (
    // Disable backdrop-click dismissal so an accidental outside click cannot
    // discard edits; Cancel, the close button, and Esc still close it.
    <ModalOverlay {...props} isDismissable={false}>
      <Modal variant="slideover" size="fullscreen">
        <Dialog aria-label="Edit project evaluator">
          {({ close }) => (
            <Suspense fallback={<Loading />}>
              {evaluatorKind === "LLM" ? (
                <EditLlmProjectEvaluator
                  projectEvaluatorId={projectEvaluatorId}
                  onClose={close}
                />
              ) : evaluatorKind === "CODE" ? (
                <EditCodeProjectEvaluator
                  projectEvaluatorId={projectEvaluatorId}
                  onClose={close}
                />
              ) : null}
            </Suspense>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
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
  return projectEvaluator;
}

function copyOutputConfigs(
  outputConfigs: ReadonlyArray<ProjectEvaluatorOutputConfig> | undefined
): AnnotationConfig[] {
  const copiedOutputConfigs: AnnotationConfig[] = [];
  for (const outputConfig of outputConfigs ?? []) {
    switch (outputConfig.__typename) {
      case "CategoricalAnnotationConfig":
        copiedOutputConfigs.push({
          name: outputConfig.name,
          optimizationDirection: outputConfig.optimizationDirection,
          values: outputConfig.values.map(({ label, score }) => ({
            label,
            ...(score == null ? {} : { score }),
          })),
        });
        break;
      case "ContinuousAnnotationConfig":
        copiedOutputConfigs.push({
          name: outputConfig.name,
          optimizationDirection: outputConfig.optimizationDirection,
          lowerBound: outputConfig.lowerBound,
          upperBound: outputConfig.upperBound,
        });
        break;
      case "FreeformAnnotationConfig":
        copiedOutputConfigs.push({
          name: outputConfig.name,
          optimizationDirection: outputConfig.optimizationDirection,
          threshold: outputConfig.threshold,
          lowerBound: outputConfig.lowerBound,
          upperBound: outputConfig.upperBound,
        });
        break;
      case "%other":
        break;
    }
  }
  return copiedOutputConfigs;
}

function getScope(
  evaluator: ReturnType<typeof useProjectEvaluator>
): ProjectEvaluatorScope {
  return {
    targetType: fromProjectEvaluatorGraphQLTarget(evaluator.evaluationTarget),
    filterCondition: evaluator.filterCondition,
    samplingRatePercent: Math.round(evaluator.samplingRate * 100),
  };
}

function EditLlmProjectEvaluator({
  projectEvaluatorId,
  onClose,
}: {
  projectEvaluatorId: string;
  onClose: () => void;
}) {
  const evaluator = useProjectEvaluator(projectEvaluatorId);
  invariant(evaluator.evaluator.kind === "LLM", "expected LLM evaluator");
  return (
    <EvaluatorPlaygroundProvider
      promptId={evaluator.evaluator.prompt?.id}
      promptName={evaluator.evaluator.prompt?.name}
      promptVersionRef={evaluator.evaluator.promptVersion}
      promptVersionTag={evaluator.evaluator.promptVersionTag?.name}
      templateFormat={evaluator.evaluator.promptVersion?.templateFormat}
    >
      <EditLlmProjectEvaluatorContent evaluator={evaluator} onClose={onClose} />
    </EvaluatorPlaygroundProvider>
  );
}

function EditLlmProjectEvaluatorContent({
  evaluator,
  onClose,
}: {
  evaluator: ReturnType<typeof useProjectEvaluator>;
  onClose: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const playgroundStore = usePlaygroundStore();
  const instanceId = usePlaygroundContext((state) => state.instances[0].id);
  invariant(instanceId != null, "instanceId is required");
  const [error, setError] = useState<string>();
  const [scope, setScope] = useState(() => getScope(evaluator));
  const [isFilterValid, setIsFilterValid] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(
    () => new Set(["scope", "definition"])
  );
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
  const outputConfigs = copyOutputConfigs(evaluator.evaluator.outputConfigs);
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
    evaluatorMappingSourceGrain: "span" as const,
    evaluatorMappingSource: {
      input: {},
      output: {},
      metadata: { attributes: {} },
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
            samplingRate: toProjectEvaluatorSamplingFraction(
              scope.samplingRatePercent
            ),
            evaluationTarget: toProjectEvaluatorGraphQLTarget(scope.targetType),
            filterCondition: scope.filterCondition,
            enabled: evaluator.enabled,
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
      {({ store }) => (
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
            <ProjectEvaluatorFormSections
              projectId={evaluator.project.id}
              scope={scope}
              onScopeChange={setScope}
              expandedKeys={expandedKeys}
              onExpandedChange={setExpandedKeys}
              definitionKind="llm"
              onFilterValidityChange={setIsFilterValid}
            />
          }
          formRightPanel={
            <ProjectEvaluatorTestPanel
              projectId={evaluator.project.id}
              filterCondition={scope.filterCondition}
            />
          }
        />
      )}
    </EvaluatorStoreProvider>
  );
}

function EditCodeProjectEvaluator({
  projectEvaluatorId,
  onClose,
}: {
  projectEvaluatorId: string;
  onClose: () => void;
}) {
  const evaluator = useProjectEvaluator(projectEvaluatorId);
  invariant(evaluator.evaluator.kind === "CODE", "expected code evaluator");
  const variables = extractCodeEvaluatorVariables({
    language: evaluator.evaluator.language as CodeEvaluatorLanguage,
    sourceCode: evaluator.evaluator.sourceCode ?? "",
  });
  // Snapshot the stored project mapping so submit can omit an unchanged mapping
  // (omit=preserve) rather than pinning an otherwise-inherited setting.
  const initialInputMappingJson = JSON.stringify(evaluator.inputMapping);
  const [scope, setScope] = useState(() => getScope(evaluator));
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(
    () => new Set(["scope", "advanced"])
  );
  const [error, setError] = useState<string>();
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
  const initialState: EvaluatorStoreProps = {
    evaluator: {
      id: evaluator.evaluator.id,
      globalName: evaluator.name,
      name: evaluator.name,
      description: evaluator.evaluator.description ?? "",
      inputMapping: evaluator.inputMapping as EvaluatorInputMapping,
      kind: "CODE",
      isBuiltin: false,
      includeExplanation: false,
    },
    outputConfigs: copyOutputConfigs(evaluator.evaluator.outputConfigs),
    showPromptPreview: false,
    evaluatorMappingSourceGrain: "span",
    evaluatorMappingSource: {
      input: {},
      output: {},
      metadata: { attributes: {} },
    },
  };
  return (
    <EvaluatorPlaygroundProvider>
      <EvaluatorStoreProvider initialState={initialState}>
        {({ store }) => (
          <ProjectCodeEvaluatorDialogContent
            mode="update"
            projectId={evaluator.project.id}
            evaluatorId={evaluator.evaluator.id}
            evaluatorName={evaluator.name}
            variables={variables}
            scope={scope}
            onScopeChange={setScope}
            expandedKeys={expandedKeys}
            onExpandedChange={setExpandedKeys}
            isSubmitting={isUpdating}
            error={error}
            onSubmit={() => {
              setError(undefined);
              const state = store.getState();
              // Only override the project's CODE mapping when the user actually
              // edited it; omitting preserves whatever is currently in effect.
              const inputMappingChanged =
                JSON.stringify(state.evaluator.inputMapping) !==
                initialInputMappingJson;
              commitUpdate({
                variables: {
                  input: {
                    projectEvaluatorId: evaluator.id,
                    name: state.evaluator.globalName,
                    description: state.evaluator.description || null,
                    evaluatorInputMapping: evaluator.evaluator
                      .inputMapping as EvaluatorInputMapping,
                    ...(inputMappingChanged
                      ? { inputMapping: state.evaluator.inputMapping }
                      : {}),
                    outputConfigs: buildOutputConfigsInput(state.outputConfigs),
                    samplingRate: toProjectEvaluatorSamplingFraction(
                      scope.samplingRatePercent
                    ),
                    evaluationTarget: toProjectEvaluatorGraphQLTarget(
                      scope.targetType
                    ),
                    filterCondition: scope.filterCondition,
                    enabled: evaluator.enabled,
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
        )}
      </EvaluatorStoreProvider>
    </EvaluatorPlaygroundProvider>
  );
}
