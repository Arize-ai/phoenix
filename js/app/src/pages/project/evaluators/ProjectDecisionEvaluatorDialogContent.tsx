import { type ReactNode, useState } from "react";
import { graphql, useMutation, useRelayEnvironment } from "react-relay";
import { useRevalidator } from "react-router";

import type { EvaluatorSubmitResult } from "@phoenix/agent/tools/approval";
import type { AnnotationConfig } from "@phoenix/components/annotation/types";
import { useTimeRange } from "@phoenix/components/datetime";
import { DecisionEvaluatorDraftProvider } from "@phoenix/components/evaluators/decision/DecisionEvaluatorDraftProvider";
import {
  commitAsync,
  type DecisionEvaluatorData,
  toDecisionEvaluatorView,
} from "@phoenix/components/evaluators/decision/decisionEvaluatorUtils";
import { deriveDecisionOutputConfigs } from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import {
  type DecisionEvaluatorDraft,
  useDecisionEvaluatorDraft,
} from "@phoenix/components/evaluators/decision/useDecisionEvaluatorDraft";
import {
  DecisionEvaluatorValidationError,
  useDecisionEvaluatorSave,
  useDeclaredInputMapping,
} from "@phoenix/components/evaluators/decision/useDecisionEvaluatorSave";
import { EvaluatorFormDialogContent } from "@phoenix/components/evaluators/EvaluatorFormDialogContent";
import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import { EvaluatorPreviewOutputConfigsProvider } from "@phoenix/components/evaluators/EvaluatorPreviewOutputConfigsContext";
import { EvaluatorValidationBanner } from "@phoenix/components/evaluators/EvaluatorValidationBanner";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import type { ProjectDecisionEvaluatorDialogContentCreateMutation } from "@phoenix/pages/project/evaluators/__generated__/ProjectDecisionEvaluatorDialogContentCreateMutation.graphql";
import type { ProjectDecisionEvaluatorDialogContentUpdateMutation } from "@phoenix/pages/project/evaluators/__generated__/ProjectDecisionEvaluatorDialogContentUpdateMutation.graphql";
import {
  ProjectDecisionEvaluatorFormSections,
  ProjectEvaluatorInputMappingDock,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import {
  type ProjectEvaluatorDecisionPreview,
  ProjectEvaluatorScopePanel,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import {
  useProjectEvaluatorSubmitHint,
  useUnboundRequiredVariables,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorSubmitHint";
import { selectPreviewEvaluatorName } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTestBench";
import {
  toEvaluationDelayInput,
  toEvaluatorRecordKind,
  type ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { refetchProjectEvaluators } from "@phoenix/pages/project/evaluators/refetchProjectEvaluators";
import { useAttachProjectEvaluator } from "@phoenix/pages/project/evaluators/useAttachProjectEvaluator";
import {
  type EvaluatorFormDirtyCheck,
  useEvaluatorFormDirtyCheck,
} from "@phoenix/pages/project/evaluators/useEvaluatorFormDirtyCheck";
import { useProjectDecisionEvaluatorDraftRegistration } from "@phoenix/pages/project/evaluators/useProjectDecisionEvaluatorDraftRegistration";
import { useProjectEvaluatorAttachRegistration } from "@phoenix/pages/project/evaluators/useProjectEvaluatorAttachRegistration";
import { getMutationErrorMessage } from "@phoenix/utils/errorUtils";

type ScopeProps = {
  projectId: string;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
};

type DialogProps = ScopeProps & {
  title: string;
  onSuccess: () => void;
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
};

const createMutation = graphql`
  mutation ProjectDecisionEvaluatorDialogContentCreateMutation(
    $input: CreateProjectDecisionEvaluatorInput!
  ) {
    createProjectDecisionEvaluator(input: $input) {
      evaluator {
        id
        name
        evaluationTarget
        filterCondition
        samplingRate
        enabled
        tracingEnabled
        evaluator {
          kind
        }
      }
    }
  }
`;

function toDecisionPreview(
  draft: DecisionEvaluatorDraft
): ProjectEvaluatorDecisionPreview {
  try {
    return { definition: draft.getTestDefinition() };
  } catch (error) {
    return { blocker: getMutationErrorMessage(error).replace(/\.$/, "") };
  }
}

function getBindingFields(scope: ProjectEvaluatorScope) {
  return {
    evaluationTarget: scope.targetType,
    samplingRate: scope.samplingRate,
    filterCondition: scope.filterCondition,
    ...toEvaluationDelayInput(scope),
    tracingEnabled: scope.tracingEnabled,
  };
}

type SubmitKind = "create" | "update" | "attach";

const SUBMIT_LABELS: Record<SubmitKind, string> = {
  create: "Create",
  update: "Update",
  attach: "Attach evaluator",
};

const ERROR_TITLES: Record<SubmitKind, string> = {
  create: "Failed to create evaluator",
  update: "Failed to update evaluator",
  attach: "Failed to attach evaluator",
};

function ProjectDecisionEvaluatorLayout({
  title,
  submitLabel,
  projectId,
  scope,
  variables,
  definition,
  decision,
  outputConfigs,
  isSubmitting,
  isSubmitDisabled,
  isFilterValid,
  error,
  showValidationError = false,
  onSubmit,
}: {
  title: string;
  submitLabel: SubmitKind;
  projectId: string;
  scope: ProjectEvaluatorScope;
  variables: readonly string[];
  definition: ReactNode;
  decision: ProjectEvaluatorDecisionPreview;
  /** What the bench colours results against: the draft's derived outputs. */
  outputConfigs: AnnotationConfig[];
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  isFilterValid: boolean;
  error?: string;
  showValidationError?: boolean;
  onSubmit: () => void;
}) {
  const unboundVariables = useUnboundRequiredVariables({ variables });
  const submitHint = useProjectEvaluatorSubmitHint({
    targetType: scope.targetType,
    isFilterValid,
    unboundVariables,
    submitLabel,
  });
  const recordKind = toEvaluatorRecordKind(scope.targetType);
  // The bench names a draft's results the way it names its preview runs.
  const evaluatorName = useEvaluatorStore(selectPreviewEvaluatorName);
  return (
    <EvaluatorPreviewOutputConfigsProvider
      value={{ outputConfigs, evaluatorName }}
    >
      <EvaluatorFormDialogContent
        title={title}
        submitLabel={SUBMIT_LABELS[submitLabel]}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        isSubmitDisabled={
          isSubmitDisabled || !isFilterValid || unboundVariables.length > 0
        }
        submitHint={submitHint}
        error={error}
        errorTitle={ERROR_TITLES[submitLabel]}
        banner={showValidationError ? <EvaluatorValidationBanner /> : null}
        contentGap="var(--global-dimension-size-100)"
        renderInputVariables={(form) => (
          <EvaluatorInputVariablesProvider variables={[...variables]}>
            {form}
          </EvaluatorInputVariablesProvider>
        )}
        left={definition}
        leftDock={
          <ProjectEvaluatorInputMappingDock
            recordKind={recordKind}
            evaluatorKind="decision"
            canDescribeInputs={false}
          />
        }
        right={
          <ProjectEvaluatorScopePanel
            projectId={projectId}
            scope={scope}
            decision={decision}
          />
        }
      />
    </EvaluatorPreviewOutputConfigsProvider>
  );
}

export function CreateProjectDecisionEvaluatorDialogContent(
  props: DialogProps
) {
  return (
    <DecisionEvaluatorDraftProvider surface="project">
      <CreateProjectDecisionEvaluatorForm {...props} />
    </DecisionEvaluatorDraftProvider>
  );
}

function CreateProjectDecisionEvaluatorForm({
  title,
  projectId,
  scope,
  onScopeChange,
  onSuccess,
  registerDirtyCheck,
}: DialogProps) {
  const store = useEvaluatorStoreInstance();
  const environment = useRelayEnvironment();
  const { timeRangeISOStrings } = useTimeRange();
  const draft = useDecisionEvaluatorDraft({});
  const { buildCreateInput } = useDecisionEvaluatorSave(draft);
  const [create] =
    useMutation<ProjectDecisionEvaluatorDialogContentCreateMutation>(
      createMutation
    );
  const [isFilterValid, setIsFilterValid] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [showValidationError, setShowValidationError] = useState(false);
  const trackStoreForDirtyCheck = useEvaluatorFormDirtyCheck({
    registerDirtyCheck,
    scope,
    alwaysDirty: true,
  });
  trackStoreForDirtyCheck(store);

  const onSubmit = async (): Promise<EvaluatorSubmitResult> => {
    setSubmitError(undefined);
    setShowValidationError(false);
    if (!isFilterValid) {
      return { ok: false, error: "Fix the filter condition." };
    }
    try {
      const input = await buildCreateInput(
        store.getState().evaluator.globalName
      );
      setIsSubmitting(true);
      const response = await commitAsync(create, {
        input: {
          ...input,
          projectId,
          ...getBindingFields(scope),
          enabled: true,
        },
      });
      await refetchProjectEvaluators({
        environment,
        projectId,
        timeRange: timeRangeISOStrings,
      });
      onSuccess();
      const { evaluator } = response.createProjectDecisionEvaluator;
      return {
        ok: true,
        acceptedBy: "user",
        evaluator: { id: evaluator.id, name: evaluator.name },
      };
    } catch (error) {
      return handleSubmitError(error);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleSubmitError = (error: unknown): EvaluatorSubmitResult => {
    if (error instanceof DecisionEvaluatorValidationError) {
      setShowValidationError(true);
      return {
        ok: false,
        error: `The form refused to save: ${error.message}`,
      };
    }
    const message = getMutationErrorMessage(error);
    setSubmitError(message);
    return { ok: false, error: message };
  };
  useProjectDecisionEvaluatorDraftRegistration({
    mode: "create",
    evaluatorNodeId: null,
    draft,
    submit: onSubmit,
  });

  return (
    <ProjectDecisionEvaluatorLayout
      title={title}
      submitLabel="create"
      projectId={projectId}
      scope={scope}
      variables={draft.variables}
      decision={toDecisionPreview(draft)}
      outputConfigs={deriveDecisionOutputConfigs(draft.questions, draft.policy)}
      isSubmitting={isSubmitting}
      isSubmitDisabled={draft.isLoading || !draft.isVersionReady}
      isFilterValid={isFilterValid}
      error={submitError ?? draft.loadError}
      showValidationError={showValidationError}
      onSubmit={() => void onSubmit()}
      definition={
        <ProjectDecisionEvaluatorFormSections
          projectId={projectId}
          scope={scope}
          onScopeChange={onScopeChange}
          onFilterValidityChange={setIsFilterValid}
          draft={draft}
          isDisabled={isSubmitting}
        />
      }
    />
  );
}

export function AttachProjectDecisionEvaluatorDialogContent({
  evaluator,
  title,
  projectId,
  scope,
  onScopeChange,
  onSuccess,
  registerDirtyCheck,
}: DialogProps & { evaluator: DecisionEvaluatorData }) {
  const store = useEvaluatorStoreInstance();
  const view = toDecisionEvaluatorView(evaluator);
  const variables = view.variables;
  const getInputMapping = useDeclaredInputMapping(variables);
  const { attach, isAttaching, error } =
    useAttachProjectEvaluator<ProjectDecisionEvaluatorDialogContentCreateMutation>(
      {
        mutation: createMutation,
        projectId,
        evaluatorId: evaluator.id,
        onSuccess,
      }
    );
  const [isFilterValid, setIsFilterValid] = useState(true);
  const trackStoreForDirtyCheck = useEvaluatorFormDirtyCheck({
    registerDirtyCheck,
    scope,
  });
  trackStoreForDirtyCheck(store);

  const attachEvaluator = () =>
    attach({
      input: {
        projectId,
        evaluatorId: evaluator.id,
        name: evaluator.name,
        inputMapping: getInputMapping(),
        ...getBindingFields(scope),
        enabled: true,
      },
    });
  const onSubmit = () => void attachEvaluator();
  useProjectEvaluatorAttachRegistration({
    target: {
      evaluatorId: evaluator.id,
      name: evaluator.name,
      kind: "DECISION",
      variables,
      // The layout holds the save while any variable is unbound.
      requiredVariables: variables,
    },
    submit: async (): Promise<EvaluatorSubmitResult> => {
      const result = await attachEvaluator();
      if (!result.ok) {
        return result;
      }
      const saved = result.response.createProjectDecisionEvaluator.evaluator;
      return {
        ok: true,
        acceptedBy: "auto",
        evaluator: { id: saved.id, name: saved.name },
      };
    },
  });

  return (
    <ProjectDecisionEvaluatorLayout
      title={title}
      submitLabel="attach"
      projectId={projectId}
      scope={scope}
      variables={variables}
      decision={{ decisionEvaluatorId: evaluator.id }}
      outputConfigs={deriveDecisionOutputConfigs(view.questions, view.policy)}
      isSubmitting={isAttaching}
      isSubmitDisabled={false}
      isFilterValid={isFilterValid}
      error={error}
      onSubmit={onSubmit}
      definition={
        <ProjectDecisionEvaluatorFormSections
          projectId={projectId}
          scope={scope}
          onScopeChange={onScopeChange}
          onFilterValidityChange={setIsFilterValid}
          attachedEvaluator={evaluator}
        />
      }
    />
  );
}

export function EditProjectDecisionEvaluatorDialogContent(
  props: DialogProps & {
    projectEvaluatorId: string;
    evaluator: DecisionEvaluatorData;
    onClose: () => void;
  }
) {
  return (
    <DecisionEvaluatorDraftProvider surface="project">
      <EditProjectDecisionEvaluatorDraft {...props} />
    </DecisionEvaluatorDraftProvider>
  );
}

function EditProjectDecisionEvaluatorDraft(
  props: Parameters<typeof EditProjectDecisionEvaluatorDialogContent>[0]
) {
  const draft = useDecisionEvaluatorDraft({
    initialEvaluator: props.evaluator,
  });
  const [hasLoaded, setHasLoaded] = useState(false);
  if (!hasLoaded && draft.isVersionReady) {
    setHasLoaded(true);
  }
  return (
    <EditProjectDecisionEvaluatorForm
      {...props}
      draft={draft}
      isDirtyCheckReady={hasLoaded}
    />
  );
}

function EditProjectDecisionEvaluatorForm({
  title,
  projectId,
  projectEvaluatorId,
  scope,
  onScopeChange,
  registerDirtyCheck,
  onClose,
  draft,
  isDirtyCheckReady,
}: Parameters<typeof EditProjectDecisionEvaluatorDialogContent>[0] & {
  draft: DecisionEvaluatorDraft;
  isDirtyCheckReady: boolean;
}) {
  const store = useEvaluatorStoreInstance();
  const notifySuccess = useNotifySuccess();
  const { revalidate } = useRevalidator();
  const { buildUpdateInput } = useDecisionEvaluatorSave(draft);
  const [update] =
    useMutation<ProjectDecisionEvaluatorDialogContentUpdateMutation>(graphql`
      mutation ProjectDecisionEvaluatorDialogContentUpdateMutation(
        $input: UpdateProjectDecisionEvaluatorInput!
      ) {
        updateProjectDecisionEvaluator(input: $input) {
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
  const [isFilterValid, setIsFilterValid] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [showValidationError, setShowValidationError] = useState(false);

  const onSubmit = async (): Promise<EvaluatorSubmitResult> => {
    setSubmitError(undefined);
    setShowValidationError(false);
    if (!isFilterValid) {
      return { ok: false, error: "Fix the filter condition." };
    }
    try {
      const input = await buildUpdateInput(
        store.getState().evaluator.globalName
      );
      setIsSubmitting(true);
      const response = await commitAsync(update, {
        input: {
          ...input,
          projectEvaluatorId,
          ...getBindingFields(scope),
        },
      });
      notifySuccess({ title: "Evaluator updated" });
      void revalidate();
      onClose();
      const { evaluator } = response.updateProjectDecisionEvaluator;
      return {
        ok: true,
        acceptedBy: "user",
        evaluator: { id: evaluator.id, name: evaluator.name },
      };
    } catch (error) {
      if (error instanceof DecisionEvaluatorValidationError) {
        setShowValidationError(true);
        return {
          ok: false,
          error: `The form refused to save: ${error.message}`,
        };
      }
      const message = getMutationErrorMessage(error);
      setSubmitError(message);
      return { ok: false, error: message };
    } finally {
      setIsSubmitting(false);
    }
  };
  useProjectDecisionEvaluatorDraftRegistration({
    mode: "edit",
    evaluatorNodeId: draft.initialEvaluator?.id ?? null,
    draft,
    submit: onSubmit,
  });

  return (
    <>
      {isDirtyCheckReady ? (
        <EditDirtyCheck
          draft={draft}
          scope={scope}
          registerDirtyCheck={registerDirtyCheck}
        />
      ) : null}
      <ProjectDecisionEvaluatorLayout
        title={title}
        submitLabel="update"
        projectId={projectId}
        scope={scope}
        variables={draft.variables}
        decision={toDecisionPreview(draft)}
        outputConfigs={deriveDecisionOutputConfigs(
          draft.questions,
          draft.policy
        )}
        isSubmitting={isSubmitting}
        isSubmitDisabled={draft.isLoading || !draft.isVersionReady}
        isFilterValid={isFilterValid}
        error={submitError ?? draft.loadError}
        showValidationError={showValidationError}
        onSubmit={() => void onSubmit()}
        definition={
          <ProjectDecisionEvaluatorFormSections
            projectId={projectId}
            scope={scope}
            onScopeChange={onScopeChange}
            onFilterValidityChange={setIsFilterValid}
            isTargetDisabled
            draft={draft}
            isDisabled={isSubmitting}
          />
        }
      />
    </>
  );
}

/** Mounted once the saved version has loaded, so loading it is not an edit. */
function EditDirtyCheck({
  draft,
  scope,
  registerDirtyCheck,
}: {
  draft: DecisionEvaluatorDraft;
  scope: ProjectEvaluatorScope;
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
}) {
  const store = useEvaluatorStoreInstance();
  const trackStoreForDirtyCheck = useEvaluatorFormDirtyCheck({
    registerDirtyCheck,
    scope,
    localState: {
      hasDecisionChanges: draft.hasDecisionChanges,
      versionId: draft.loadedVersionId,
      tag: draft.selectedTagName,
      policy: draft.policy,
    },
  });
  trackStoreForDirtyCheck(store);
  return null;
}
