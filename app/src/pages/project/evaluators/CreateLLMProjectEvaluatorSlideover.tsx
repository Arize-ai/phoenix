import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import type { ModalOverlayProps } from "react-aria-components";
import { graphql, useMutation, useRelayEnvironment } from "react-relay";
import invariant from "tiny-invariant";

import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { Dialog } from "@phoenix/components/core/dialog";
import { Loading } from "@phoenix/components/core/loading";
import { Modal, ModalOverlay } from "@phoenix/components/core/overlay/Modal";
import { createDefaultFreeformOutputConfig } from "@phoenix/components/evaluators/EditCodeEvaluatorDialogContent";
import { EditLLMEvaluatorDialogContent } from "@phoenix/components/evaluators/EditLLMEvaluatorDialogContent";
import { getSpanEvaluatorDefaultMessages } from "@phoenix/components/evaluators/EvaluatorChatTemplate/utils";
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
import { CreateProjectCodeEvaluatorDialogContent } from "@phoenix/pages/project/evaluators/CreateProjectCodeEvaluatorDialogContent";
import { createProjectLlmEvaluator } from "@phoenix/pages/project/evaluators/createProjectLlmEvaluator";
import {
  DiscardEvaluatorChangesDialog,
  isModalUnderlay,
} from "@phoenix/pages/project/evaluators/DiscardEvaluatorChangesDialog";
import { ProjectCodeEvaluatorDialogContent } from "@phoenix/pages/project/evaluators/ProjectCodeEvaluatorDialogContent";
import { ProjectEvaluatorFormSections } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import { ProjectEvaluatorScopePanel } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import { useProjectEvaluatorSubmitHint } from "@phoenix/pages/project/evaluators/ProjectEvaluatorSubmitHint";
import {
  toProjectEvaluatorGraphQLTarget,
  toProjectEvaluatorSamplingFraction,
  type ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  useEvaluatorFormDirtyCheck,
  type EvaluatorFormDirtyCheck,
} from "@phoenix/pages/project/evaluators/useEvaluatorFormDirtyCheck";
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
  | { kind: "newCode" }
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
    if (creationMode.kind === "copy") {
      return creationMode.initialState.defaultMessages;
    }
    if (creationMode.kind === "scratch") {
      // Span-grain defaults: only variables that exist in the span evaluation
      // context, so the template binds zero-config on real spans.
      return getSpanEvaluatorDefaultMessages();
    }
    return undefined;
  }, [creationMode]);
  const templateFormat =
    creationMode.kind === "copy"
      ? creationMode.initialState.templateFormat
      : undefined;
  // Backdrop clicks close an untouched form immediately; once there are
  // edits, the click asks for confirmation instead of silently dropping work.
  const dirtyCheckRef = useRef<EvaluatorFormDirtyCheck>(() => false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  return (
    <>
      <ModalOverlay
        {...props}
        isDismissable
        shouldCloseOnInteractOutside={(element) => {
          // Portalled popovers/menus inside the form also register as
          // "outside" the modal — only a genuine backdrop click may dismiss.
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
                    registerDirtyCheck={(check) => {
                      dirtyCheckRef.current = check;
                    }}
                  />
                </EvaluatorPlaygroundProvider>
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
};

const CreateProjectEvaluatorDialog = ({
  onClose,
  projectId,
  creationMode,
  updateConnectionIds,
  registerDirtyCheck,
}: {
  onClose: () => void;
  projectId: string;
  creationMode: ProjectEvaluatorCreationMode;
  updateConnectionIds?: string[];
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
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
  const trackStoreForDirtyCheck = useEvaluatorFormDirtyCheck({
    registerDirtyCheck,
    scope,
    playgroundStore,
    // The code source editor keeps its draft in local state this check cannot
    // observe, so treat the new-code form as always worth confirming.
    alwaysDirty: creationMode.kind === "newCode",
  });
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
    if (creationMode.kind === "newCode") {
      return {
        ...DEFAULT_LLM_EVALUATOR_STORE_VALUES,
        evaluator: {
          ...DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator,
          globalName: "",
          description: "",
          inputMapping: { pathMapping: {}, literalMapping: {} },
          kind: "CODE",
        },
        outputConfigs: [createDefaultFreeformOutputConfig("")],
        evaluatorMappingSourceGrain: "span",
        evaluatorMappingSource: {
          input: {},
          output: {},
          metadata: { attributes: {} },
        },
      } satisfies EvaluatorStoreProps;
    }
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
      {({ store }) => {
        trackStoreForDirtyCheck(store);
        return creationMode.kind === "newCode" ? (
          <CreateProjectCodeEvaluatorDialogContent
            projectId={projectId}
            scope={scope}
            onScopeChange={setScope}
            updateConnectionIds={updateConnectionIds}
            onSuccess={finishCreation}
          />
        ) : creationMode.kind === "code" ? (
          <ProjectCodeEvaluatorDialogContent
            projectId={projectId}
            evaluatorId={creationMode.evaluatorId}
            evaluatorName={creationMode.name}
            variables={creationMode.variables}
            scope={scope}
            onScopeChange={setScope}
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
          <ScratchLlmDialogContent
            projectId={projectId}
            scope={scope}
            onScopeChange={setScope}
            isFilterValid={isFilterValid}
            onFilterValidityChange={setIsFilterValid}
            onClose={onClose}
            onSubmit={() => submitLlm(store)}
            isSubmitting={isSubmittingLlm}
            error={error}
          />
        );
      }}
    </EvaluatorStoreProvider>
  );
};

const ScratchLlmDialogContent = ({
  projectId,
  scope,
  onScopeChange,
  isFilterValid,
  onFilterValidityChange,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  projectId: string;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  isFilterValid: boolean;
  onFilterValidityChange: (isValid: boolean) => void;
  onClose: () => void;
  onSubmit: () => Promise<EvaluatorSubmitResult>;
  isSubmitting: boolean;
  error?: string;
}) => {
  const submitHint = useProjectEvaluatorSubmitHint({ isFilterValid });
  return (
    <EditLLMEvaluatorDialogContent
      title="Create project evaluator"
      onClose={onClose}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      isSubmitDisabled={!isFilterValid}
      submitHint={submitHint}
      mode="create"
      error={error}
      formLeftPanel={<ProjectEvaluatorFormSections definitionKind="llm" />}
      formRightPanel={
        <ProjectEvaluatorScopePanel
          projectId={projectId}
          scope={scope}
          onScopeChange={onScopeChange}
          onFilterValidityChange={onFilterValidityChange}
          mode="create"
          showAnnotationTemplate
        />
      }
    />
  );
};
