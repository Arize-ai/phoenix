import { Suspense, useCallback, useMemo, useState } from "react";
import type { Key, ModalOverlayProps } from "react-aria-components";
import { graphql, useMutation, useRelayEnvironment } from "react-relay";
import invariant from "tiny-invariant";

import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { Dialog } from "@phoenix/components/core/dialog";
import { Loading } from "@phoenix/components/core/loading";
import { Modal, ModalOverlay } from "@phoenix/components/core/overlay/Modal";
import { EditLLMEvaluatorDialogContent } from "@phoenix/components/evaluators/EditLLMEvaluatorDialogContent";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import {
  createLLMEvaluatorPayload,
  getOutputConfigValidationErrors,
} from "@phoenix/components/evaluators/utils";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import type { CreateLLMProjectEvaluatorSlideoverAddCodeMutation } from "@phoenix/pages/project/evaluators/__generated__/CreateLLMProjectEvaluatorSlideoverAddCodeMutation.graphql";
import { createProjectLlmEvaluator } from "@phoenix/pages/project/evaluators/createProjectLlmEvaluator";
import { ProjectCodeEvaluatorDialogContent } from "@phoenix/pages/project/evaluators/ProjectCodeEvaluatorDialogContent";
import { ProjectEvaluatorFormSections } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import { ProjectEvaluatorTestPanel } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTestPanel";
import {
  toProjectEvaluatorGraphQLTarget,
  toProjectEvaluatorSamplingFraction,
  type ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { PlaygroundChatTemplate } from "@phoenix/store";
import {
  DEFAULT_LLM_EVALUATOR_STORE_VALUES,
  type AnnotationConfig,
  type EvaluatorStoreInstance,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";
import type { EvaluatorInputMapping } from "@phoenix/types";

export type ProjectEvaluatorCreationMode =
  | { kind: "scratch" }
  | {
      kind: "copy";
      initialState: {
        name: string;
        description: string;
        outputConfigs: AnnotationConfig[];
        defaultMessages: PlaygroundChatTemplate["messages"];
        templateFormat: TemplateFormat;
        includeExplanation: boolean;
      };
    }
  | {
      kind: "code";
      evaluatorId: string;
      name: string;
      description: string;
      inputMapping: EvaluatorInputMapping;
      outputConfigs: AnnotationConfig[];
      variables: string[];
    };

export const CreateLLMProjectEvaluatorSlideover = ({
  projectId,
  creationMode,
  updateConnectionIds,
  ...props
}: {
  projectId: string;
  creationMode: ProjectEvaluatorCreationMode;
  updateConnectionIds?: string[];
} & ModalOverlayProps) => {
  const defaultMessages = useMemo(() => {
    if (creationMode.kind !== "copy") {
      return undefined;
    }
    return creationMode.initialState.defaultMessages;
  }, [creationMode]);
  const templateFormat =
    creationMode.kind === "copy"
      ? creationMode.initialState.templateFormat
      : undefined;
  return (
    // Disable backdrop-click dismissal so an accidental outside click cannot
    // discard the form; Cancel, the close button, and Esc still close it.
    <ModalOverlay {...props} isDismissable={false}>
      <Modal variant="slideover" size="fullscreen">
        <Dialog aria-label="Create project evaluator">
          {({ close }) => (
            <Suspense fallback={<Loading />}>
              <EvaluatorPlaygroundProvider
                defaultMessages={defaultMessages}
                templateFormat={templateFormat}
              >
                <CreateProjectEvaluatorDialog
                  onClose={close}
                  projectId={projectId}
                  creationMode={creationMode}
                  updateConnectionIds={updateConnectionIds}
                />
              </EvaluatorPlaygroundProvider>
            </Suspense>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

const CreateProjectEvaluatorDialog = ({
  onClose,
  projectId,
  creationMode,
  updateConnectionIds,
}: {
  onClose: () => void;
  projectId: string;
  creationMode: ProjectEvaluatorCreationMode;
  updateConnectionIds?: string[];
}) => {
  const notifySuccess = useNotifySuccess();
  const environment = useRelayEnvironment();
  const playgroundStore = usePlaygroundStore();
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = instances[0].id;
  invariant(instanceId != null, "instanceId is required");
  const [error, setError] = useState<string | undefined>();
  const [isSubmittingLlm, setIsSubmittingLlm] = useState(false);
  const [isFilterValid, setIsFilterValid] = useState(true);
  const [scope, setScope] = useState<ProjectEvaluatorScope>({
    targetType: "span",
    filterCondition: "",
    samplingRatePercent: 100,
  });
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(
    () => new Set(["scope"])
  );
  const [addCodeEvaluator, isAddingCodeEvaluator] =
    useMutation<CreateLLMProjectEvaluatorSlideoverAddCodeMutation>(graphql`
      mutation CreateLLMProjectEvaluatorSlideoverAddCodeMutation(
        $input: AddProjectCodeEvaluatorInput!
        $connectionIds: [ID!]!
      ) {
        addProjectCodeEvaluator(input: $input) {
          evaluator
            @appendNode(
              connections: $connectionIds
              edgeTypeName: "ProjectEvaluatorEdge"
            ) {
            id
            name
            evaluationTarget
            filterCondition
            samplingRate
            enabled
            evaluator {
              kind
            }
          }
        }
      }
    `);

  const initialState = useMemo(() => {
    const copiedState =
      creationMode.kind === "copy" ? creationMode.initialState : undefined;
    const defaultEvaluatorName = copiedState?.name
      ? `${copiedState.name} copy`
      : creationMode.kind === "code"
        ? creationMode.name
        : DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator.globalName;
    const outputConfigs =
      creationMode.kind === "code"
        ? creationMode.outputConfigs
        : (copiedState?.outputConfigs ??
          DEFAULT_LLM_EVALUATOR_STORE_VALUES.outputConfigs);
    return {
      ...DEFAULT_LLM_EVALUATOR_STORE_VALUES,
      evaluator: {
        ...DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator,
        globalName: defaultEvaluatorName,
        description:
          creationMode.kind === "code"
            ? creationMode.description
            : (copiedState?.description ?? ""),
        inputMapping:
          creationMode.kind === "code"
            ? creationMode.inputMapping
            : { pathMapping: {}, literalMapping: {} },
        kind: creationMode.kind === "code" ? "CODE" : "LLM",
        includeExplanation:
          copiedState?.includeExplanation ??
          DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator.includeExplanation,
      },
      outputConfigs:
        copiedState || creationMode.kind === "code"
          ? outputConfigs
          : outputConfigs[0]
            ? [{ ...outputConfigs[0], name: defaultEvaluatorName }]
            : [],
      evaluatorMappingSourceGrain: "span",
      evaluatorMappingSource: {
        input: {},
        output: {},
        metadata: { attributes: {} },
      },
    } satisfies EvaluatorStoreProps;
  }, [creationMode]);

  const finishCreation = useCallback(() => {
    onClose();
    notifySuccess({ title: "Evaluator created" });
  }, [notifySuccess, onClose]);

  const submitLlm = useCallback(
    async (store: EvaluatorStoreInstance): Promise<EvaluatorSubmitResult> => {
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
      setIsSubmittingLlm(true);
      try {
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
        const evaluator = await createProjectLlmEvaluator({
          environment,
          updateConnectionIds,
          input: {
            ...llmInput,
            inputMapping: state.evaluator.inputMapping,
            projectId,
            evaluationTarget: toProjectEvaluatorGraphQLTarget(scope.targetType),
            samplingRate: toProjectEvaluatorSamplingFraction(
              scope.samplingRatePercent
            ),
            filterCondition: scope.filterCondition,
            enabled: true,
          },
        });
        finishCreation();
        return { ok: true, acceptedBy: "user", evaluator };
      } catch (submissionError) {
        const message =
          submissionError instanceof Error
            ? submissionError.message
            : "Failed to create evaluator";
        setError(message);
        return { ok: false, error: message };
      } finally {
        setIsSubmittingLlm(false);
      }
    },
    [
      environment,
      finishCreation,
      instanceId,
      playgroundStore,
      projectId,
      scope,
      updateConnectionIds,
    ]
  );

  return (
    <EvaluatorStoreProvider initialState={initialState}>
      {({ store }) =>
        creationMode.kind === "code" ? (
          <ProjectCodeEvaluatorDialogContent
            projectId={projectId}
            evaluatorId={creationMode.evaluatorId}
            evaluatorName={creationMode.name}
            variables={creationMode.variables}
            scope={scope}
            onScopeChange={setScope}
            expandedKeys={expandedKeys}
            onExpandedChange={setExpandedKeys}
            isSubmitting={isAddingCodeEvaluator}
            error={error}
            onSubmit={() => {
              setError(undefined);
              addCodeEvaluator({
                variables: {
                  input: {
                    projectId,
                    evaluatorId: creationMode.evaluatorId,
                    name: creationMode.name,
                    samplingRate: toProjectEvaluatorSamplingFraction(
                      scope.samplingRatePercent
                    ),
                    evaluationTarget: toProjectEvaluatorGraphQLTarget(
                      scope.targetType
                    ),
                    filterCondition: scope.filterCondition,
                    enabled: true,
                    inputMapping: store.getState().evaluator.inputMapping,
                  },
                  connectionIds: updateConnectionIds ?? [],
                },
                onCompleted: (_response, errors) => {
                  if (errors?.length) {
                    setError(errors.map(({ message }) => message).join("\n"));
                    return;
                  }
                  finishCreation();
                },
                onError: (mutationError) => setError(mutationError.message),
              });
            }}
          />
        ) : (
          <EditLLMEvaluatorDialogContent
            title="Create project evaluator"
            onClose={onClose}
            onSubmit={() => submitLlm(store)}
            isSubmitting={isSubmittingLlm}
            isSubmitDisabled={!isFilterValid}
            mode="create"
            error={error}
            formLeftPanel={
              <ProjectEvaluatorFormSections
                projectId={projectId}
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
                projectId={projectId}
                filterCondition={scope.filterCondition}
              />
            }
          />
        )
      }
    </EvaluatorStoreProvider>
  );
};
