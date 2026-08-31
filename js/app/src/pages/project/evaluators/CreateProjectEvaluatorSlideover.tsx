import { useState } from "react";
import type { ModalOverlayProps } from "react-aria-components";
import {
  ConnectionHandler,
  graphql,
  useMutation,
  useRelayEnvironment,
} from "react-relay";
import invariant from "tiny-invariant";

import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { useTimeRange } from "@phoenix/components/datetime";
import { createDefaultFreeformOutputConfig } from "@phoenix/components/evaluators/CodeEvaluatorAnnotationSection";
import { EditLLMEvaluatorDialogContent } from "@phoenix/components/evaluators/EditLLMEvaluatorDialogContent";
import { getSpanEvaluatorDefaultMessages } from "@phoenix/components/evaluators/EvaluatorChatTemplate/utils";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import {
  createLLMEvaluatorPayload,
  getOutputConfigValidationErrors,
} from "@phoenix/components/evaluators/utils";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import {
  EvaluatorStoreProvider,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import type { CreateProjectEvaluatorSlideoverAddCodeMutation } from "@phoenix/pages/project/evaluators/__generated__/CreateProjectEvaluatorSlideoverAddCodeMutation.graphql";
import { CreateProjectCodeEvaluatorDialogContent } from "@phoenix/pages/project/evaluators/CreateProjectCodeEvaluatorDialogContent";
import { createProjectLlmEvaluator } from "@phoenix/pages/project/evaluators/createProjectLlmEvaluator";
import { ProjectCodeEvaluatorDialogContent } from "@phoenix/pages/project/evaluators/ProjectCodeEvaluatorDialogContent";
import { ProjectLlmEvaluatorFormSections } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import { PROJECT_EVALUATOR_GALLERY_CUSTOM_EVALUATORS_CONNECTION_KEY } from "@phoenix/pages/project/evaluators/projectEvaluatorGalleryConstants";
import { ProjectEvaluatorScopePanel } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import { ProjectEvaluatorSlideover } from "@phoenix/pages/project/evaluators/ProjectEvaluatorSlideover";
import { useProjectEvaluatorSubmitHint } from "@phoenix/pages/project/evaluators/ProjectEvaluatorSubmitHint";
import {
  DEFAULT_EVALUATION_DELAY_SECONDS,
  toEvaluationDelayInput,
  toEvaluatorMappingSourceGrain,
  type ProjectEvaluatorScope,
  type ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { refetchProjectEvaluators } from "@phoenix/pages/project/evaluators/refetchProjectEvaluators";
import {
  useEvaluatorFormDirtyCheck,
  type EvaluatorFormDirtyCheck,
} from "@phoenix/pages/project/evaluators/useEvaluatorFormDirtyCheck";
import type { PlaygroundChatTemplate } from "@phoenix/store";
import {
  DEFAULT_LLM_EVALUATOR_STORE_VALUES,
  defaultEvaluatorMappingSourceState,
  type AnnotationConfig,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";

type SeededLlmEvaluatorInitialState = {
  name: string;
  description: string;
  outputConfigs: AnnotationConfig[];
  defaultMessages: PlaygroundChatTemplate["messages"];
  templateFormat: TemplateFormat;
  includeExplanation: boolean;
};

type TemplateLlmEvaluatorInitialState = SeededLlmEvaluatorInitialState & {
  targetType: ProjectEvaluatorTarget;
};

export type ProjectEvaluatorCreationMode =
  | { kind: "scratch" }
  | { kind: "newCode" }
  | {
      kind: "copy";
      initialState: SeededLlmEvaluatorInitialState;
    }
  | {
      kind: "template";
      initialState: TemplateLlmEvaluatorInitialState;
    }
  | {
      kind: "code";
      evaluatorId: string;
      name: string;
      description: string;
      outputConfigs: AnnotationConfig[];
      variables: string[];
      requiredVariables: string[];
    };

/** The slideover heading: the flow, and the kind of evaluator it creates. */
function getProjectEvaluatorCreationTitle(
  creationMode: ProjectEvaluatorCreationMode
): string {
  if (creationMode.kind === "scratch") {
    return "Create new LLM evaluator";
  }
  if (creationMode.kind === "newCode") {
    return "Create new code evaluator";
  }
  if (creationMode.kind === "copy") {
    return `Copy LLM evaluator “${creationMode.initialState.name}”`;
  }
  if (creationMode.kind === "template") {
    return `Create “${creationMode.initialState.name}” evaluator`;
  }
  return `Attach code evaluator “${creationMode.name}”`;
}

export const CreateProjectEvaluatorSlideover = ({
  projectId,
  creationMode,
  ...props
}: {
  projectId: string;
  creationMode: ProjectEvaluatorCreationMode;
} & Omit<ModalOverlayProps, "children">) => (
  <ProjectEvaluatorSlideover
    {...props}
    title={getProjectEvaluatorCreationTitle(creationMode)}
  >
    {(close, registerDirtyCheck) => (
      <CreateProjectEvaluatorDialogForMode
        onClose={close}
        projectId={projectId}
        creationMode={creationMode}
        registerDirtyCheck={registerDirtyCheck}
      />
    )}
  </ProjectEvaluatorSlideover>
);

function CreateProjectEvaluatorDialogForMode(
  props: Parameters<typeof CreateProjectEvaluatorDialog>[0]
) {
  const { creationMode } = props;
  if (
    creationMode.kind === "scratch" ||
    creationMode.kind === "copy" ||
    creationMode.kind === "template"
  ) {
    const defaultMessages =
      creationMode.kind === "scratch"
        ? getSpanEvaluatorDefaultMessages()
        : creationMode.initialState.defaultMessages;
    const templateFormat =
      creationMode.kind === "scratch"
        ? undefined
        : creationMode.initialState.templateFormat;
    return (
      <EvaluatorPlaygroundProvider
        defaultMessages={defaultMessages}
        templateFormat={templateFormat}
      >
        <CreateProjectEvaluatorDialog {...props} />
      </EvaluatorPlaygroundProvider>
    );
  }
  return <CreateProjectEvaluatorDialog {...props} />;
}

const CreateProjectEvaluatorDialog = ({
  onClose,
  projectId,
  creationMode,
  registerDirtyCheck,
}: {
  onClose: () => void;
  projectId: string;
  creationMode: ProjectEvaluatorCreationMode;
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
}) => {
  const notifySuccess = useNotifySuccess();
  const initialTargetType =
    creationMode.kind === "template"
      ? creationMode.initialState.targetType
      : "SPAN";
  const [scope, setScope] = useState<ProjectEvaluatorScope>({
    targetType: initialTargetType,
    filterCondition: "",
    samplingRate: 1,
    evaluationDelaySeconds: DEFAULT_EVALUATION_DELAY_SECONDS,
  });

  const initialState = (() => {
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
        evaluatorMappingSource: defaultEvaluatorMappingSourceState(
          toEvaluatorMappingSourceGrain(scope.targetType)
        ),
      } satisfies EvaluatorStoreProps;
    }
    const seededState =
      creationMode.kind === "copy" || creationMode.kind === "template"
        ? creationMode.initialState
        : undefined;
    const defaultEvaluatorName =
      creationMode.kind === "copy"
        ? creationMode.initialState.name
          ? `${creationMode.initialState.name} copy`
          : DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator.globalName
        : creationMode.kind === "template"
          ? creationMode.initialState.name
          : creationMode.kind === "code"
            ? creationMode.name
            : DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator.globalName;
    const outputConfigs =
      creationMode.kind === "code"
        ? creationMode.outputConfigs
        : (seededState?.outputConfigs ??
          DEFAULT_LLM_EVALUATOR_STORE_VALUES.outputConfigs);
    return {
      ...DEFAULT_LLM_EVALUATOR_STORE_VALUES,
      evaluator: {
        ...DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator,
        globalName: defaultEvaluatorName,
        description:
          creationMode.kind === "code"
            ? creationMode.description
            : (seededState?.description ?? ""),
        inputMapping: { pathMapping: {}, literalMapping: {} },
        kind: creationMode.kind === "code" ? "CODE" : "LLM",
        includeExplanation:
          seededState?.includeExplanation ??
          DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator.includeExplanation,
      },
      outputConfigs:
        seededState || creationMode.kind === "code"
          ? outputConfigs
          : outputConfigs[0]
            ? [{ ...outputConfigs[0], name: defaultEvaluatorName }]
            : [],
      evaluatorMappingSource: defaultEvaluatorMappingSourceState(
        toEvaluatorMappingSourceGrain(scope.targetType)
      ),
    } satisfies EvaluatorStoreProps;
  })();

  const finishCreation = () => {
    onClose();
    notifySuccess({ title: "Evaluator created" });
  };

  // The same pure derivation the slideover used to name the dialog, so the
  // heading below and the accessible name are always the same string.
  const title = getProjectEvaluatorCreationTitle(creationMode);

  return (
    <EvaluatorStoreProvider initialState={initialState}>
      {creationMode.kind === "newCode" ? (
        <CreateNewCodeProjectEvaluatorDialog
          title={title}
          projectId={projectId}
          scope={scope}
          onScopeChange={setScope}
          onSuccess={finishCreation}
          registerDirtyCheck={registerDirtyCheck}
        />
      ) : creationMode.kind === "code" ? (
        <AttachCodeProjectEvaluatorDialog
          title={title}
          projectId={projectId}
          creationMode={creationMode}
          scope={scope}
          onScopeChange={setScope}
          onSuccess={finishCreation}
          registerDirtyCheck={registerDirtyCheck}
        />
      ) : (
        <CreateLlmProjectEvaluatorDialog
          title={title}
          projectId={projectId}
          scope={scope}
          onScopeChange={setScope}
          onClose={onClose}
          onSuccess={finishCreation}
          registerDirtyCheck={registerDirtyCheck}
        />
      )}
    </EvaluatorStoreProvider>
  );
};

function CreateNewCodeProjectEvaluatorDialog({
  title,
  projectId,
  scope,
  onScopeChange,
  onSuccess,
  registerDirtyCheck,
}: {
  title: string;
  projectId: string;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  onSuccess: () => void;
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
}) {
  const store = useEvaluatorStoreInstance();
  const trackStoreForDirtyCheck = useEvaluatorFormDirtyCheck({
    registerDirtyCheck,
    scope,
    alwaysDirty: true,
  });
  trackStoreForDirtyCheck(store);
  return (
    <CreateProjectCodeEvaluatorDialogContent
      title={title}
      projectId={projectId}
      scope={scope}
      onScopeChange={onScopeChange}
      onSuccess={onSuccess}
    />
  );
}

function AttachCodeProjectEvaluatorDialog({
  title,
  projectId,
  creationMode,
  scope,
  onScopeChange,
  onSuccess,
  registerDirtyCheck,
}: {
  title: string;
  projectId: string;
  creationMode: Extract<ProjectEvaluatorCreationMode, { kind: "code" }>;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  onSuccess: () => void;
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
}) {
  const store = useEvaluatorStoreInstance();
  const environment = useRelayEnvironment();
  const { timeRangeISOStrings } = useTimeRange();
  const [error, setError] = useState<string>();
  const trackStoreForDirtyCheck = useEvaluatorFormDirtyCheck({
    registerDirtyCheck,
    scope,
  });
  trackStoreForDirtyCheck(store);
  const [addCodeEvaluator, isAddingCodeEvaluator] =
    useMutation<CreateProjectEvaluatorSlideoverAddCodeMutation>(graphql`
      mutation CreateProjectEvaluatorSlideoverAddCodeMutation(
        $input: AddProjectCodeEvaluatorInput!
      ) {
        addProjectCodeEvaluator(input: $input) {
          evaluator {
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
  return (
    <ProjectCodeEvaluatorDialogContent
      title={title}
      projectId={projectId}
      evaluatorId={creationMode.evaluatorId}
      evaluatorName={creationMode.name}
      variables={creationMode.variables}
      requiredVariables={creationMode.requiredVariables}
      scope={scope}
      onScopeChange={onScopeChange}
      isSubmitting={isAddingCodeEvaluator}
      error={error}
      onFieldChange={() => setError(undefined)}
      onSubmit={() => {
        setError(undefined);
        addCodeEvaluator({
          variables: {
            input: {
              projectId,
              evaluatorId: creationMode.evaluatorId,
              name: creationMode.name,
              samplingRate: scope.samplingRate,
              evaluationTarget: scope.targetType,
              filterCondition: scope.filterCondition,
              ...toEvaluationDelayInput(scope),
              enabled: true,
              inputMapping: null,
            },
          },
          updater: (relayStore) => {
            const galleryConnection = ConnectionHandler.getConnection(
              relayStore.getRoot(),
              PROJECT_EVALUATOR_GALLERY_CUSTOM_EVALUATORS_CONNECTION_KEY,
              { excludeProjectId: projectId }
            );
            if (galleryConnection) {
              ConnectionHandler.deleteNode(
                galleryConnection,
                creationMode.evaluatorId
              );
            }
          },
          onCompleted: (_response, errors) => {
            if (errors?.length) {
              setError(errors.map(({ message }) => message).join("\n"));
              return;
            }
            void refetchProjectEvaluators({
              environment,
              projectId,
              timeRange: timeRangeISOStrings,
            })
              .then(onSuccess)
              .catch((refetchError: unknown) =>
                setError(
                  refetchError instanceof Error
                    ? refetchError.message
                    : "Unable to refresh project evaluators"
                )
              );
          },
          onError: (mutationError) => setError(mutationError.message),
        });
      }}
    />
  );
}

function CreateLlmProjectEvaluatorDialog({
  title,
  projectId,
  scope,
  onScopeChange,
  onClose,
  onSuccess,
  registerDirtyCheck,
}: {
  title: string;
  projectId: string;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  onClose: () => void;
  onSuccess: () => void;
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
}) {
  const store = useEvaluatorStoreInstance();
  const environment = useRelayEnvironment();
  const { timeRangeISOStrings } = useTimeRange();
  const playgroundStore = usePlaygroundStore();
  const instanceId = usePlaygroundContext((state) => state.instances[0].id);
  invariant(instanceId != null, "instanceId is required");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFilterValid, setIsFilterValid] = useState(true);
  const trackStoreForDirtyCheck = useEvaluatorFormDirtyCheck({
    registerDirtyCheck,
    scope,
    playgroundStore,
  });
  trackStoreForDirtyCheck(store);

  const submit = async (): Promise<EvaluatorSubmitResult> => {
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
    setIsSubmitting(true);
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
        input: {
          ...llmInput,
          inputMapping: state.evaluator.inputMapping,
          projectId,
          evaluationTarget: scope.targetType,
          samplingRate: scope.samplingRate,
          filterCondition: scope.filterCondition,
          ...toEvaluationDelayInput(scope),
          enabled: true,
        },
      });
      await refetchProjectEvaluators({
        environment,
        projectId,
        timeRange: timeRangeISOStrings,
      });
      onSuccess();
      return { ok: true, acceptedBy: "user", evaluator };
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to create evaluator";
      setError(message);
      return { ok: false, error: message };
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScratchLlmDialogContent
      title={title}
      projectId={projectId}
      scope={scope}
      onScopeChange={onScopeChange}
      isFilterValid={isFilterValid}
      onFilterValidityChange={setIsFilterValid}
      onClose={onClose}
      onSubmit={submit}
      isSubmitting={isSubmitting}
      error={error}
    />
  );
}

const ScratchLlmDialogContent = ({
  title,
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
  title: string;
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
      title={title}
      onClose={onClose}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      isSubmitDisabled={!isFilterValid}
      submitHint={submitHint}
      mode="create"
      error={error}
      formLeftPanel={
        <ProjectLlmEvaluatorFormSections
          projectId={projectId}
          scope={scope}
          onScopeChange={onScopeChange}
          onFilterValidityChange={onFilterValidityChange}
        />
      }
      formRightPanel={
        <ProjectEvaluatorScopePanel projectId={projectId} scope={scope} />
      }
    />
  );
};
