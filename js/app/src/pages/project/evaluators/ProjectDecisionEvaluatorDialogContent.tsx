import { type ReactNode, useState } from "react";
import { graphql, useMutation, useRelayEnvironment } from "react-relay";
import { useRevalidator } from "react-router";

import { useTimeRange } from "@phoenix/components/datetime";
import { DecisionEvaluatorDraftProvider } from "@phoenix/components/evaluators/decision/DecisionEvaluatorDraftProvider";
import {
  commitAsync,
  type DecisionEvaluatorData,
  getMutationErrorMessage,
  inputNamesFromSchema,
} from "@phoenix/components/evaluators/decision/decisionEvaluatorUtils";
import {
  type DecisionEvaluatorDraft,
  useDecisionEvaluatorDraft,
} from "@phoenix/components/evaluators/decision/useDecisionEvaluatorDraft";
import {
  useDecisionEvaluatorSave,
  useDeclaredInputMapping,
} from "@phoenix/components/evaluators/decision/useDecisionEvaluatorSave";
import { EvaluatorFormDialogContent } from "@phoenix/components/evaluators/EvaluatorFormDialogContent";
import { CodeEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/CodeEvaluatorInputVariablesProvider";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import {
  createDecisionQuestion,
  createDecisionStateDraft,
} from "@phoenix/pages/playground/decisionUtils";
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
import type { DecisionPromptDraft } from "@phoenix/store/playground";

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

function createProjectDecisionDraft(): DecisionPromptDraft {
  return {
    state: createDecisionStateDraft({
      template: "Request:\n{{input}}\n\nResponse:\n{{output}}",
    }),
    questions: [
      createDecisionQuestion({
        type: "predicate",
        name: "relevant",
        instructions: "Does the response address the request?",
      }),
    ],
  };
}

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
    const { decisionVersion, scoringPolicy } = draft.getDefinition("", "test");
    return { definition: { decisionVersion, scoringPolicy } };
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
  };
}

function ProjectDecisionEvaluatorLayout({
  title,
  submitLabel,
  projectId,
  scope,
  variables,
  definition,
  decision,
  isSubmitting,
  isSubmitDisabled,
  isFilterValid,
  error,
  onSubmit,
}: {
  title: string;
  submitLabel: "create" | "update";
  projectId: string;
  scope: ProjectEvaluatorScope;
  variables: readonly string[];
  definition: ReactNode;
  decision: ProjectEvaluatorDecisionPreview;
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  isFilterValid: boolean;
  error?: string;
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
  return (
    <EvaluatorFormDialogContent
      title={title}
      submitLabel={submitLabel === "create" ? "Create" : "Update"}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      isSubmitDisabled={
        isSubmitDisabled || !isFilterValid || unboundVariables.length > 0
      }
      submitHint={submitHint}
      error={error}
      errorTitle={
        submitLabel === "create"
          ? "Failed to create evaluator"
          : "Failed to update evaluator"
      }
      contentGap="var(--global-dimension-size-100)"
      renderInputVariables={(form) => (
        <CodeEvaluatorInputVariablesProvider variables={[...variables]}>
          {form}
        </CodeEvaluatorInputVariablesProvider>
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
  );
}

export function CreateProjectDecisionEvaluatorDialogContent(
  props: DialogProps
) {
  const [defaultDraft] = useState(createProjectDecisionDraft);
  return (
    <DecisionEvaluatorDraftProvider defaultDraft={defaultDraft}>
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
  const trackStoreForDirtyCheck = useEvaluatorFormDirtyCheck({
    registerDirtyCheck,
    scope,
    alwaysDirty: true,
  });
  trackStoreForDirtyCheck(store);

  const onSubmit = async () => {
    setSubmitError(undefined);
    try {
      const input = await buildCreateInput(
        store.getState().evaluator.globalName
      );
      setIsSubmitting(true);
      await commitAsync(create, {
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
    } catch (error) {
      setSubmitError(getMutationErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProjectDecisionEvaluatorLayout
      title={title}
      submitLabel="create"
      projectId={projectId}
      scope={scope}
      variables={draft.variables}
      decision={toDecisionPreview(draft)}
      isSubmitting={isSubmitting}
      isSubmitDisabled={draft.isLoading || !draft.isVersionReady}
      isFilterValid={isFilterValid}
      error={submitError ?? draft.loadError}
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
  const variables = inputNamesFromSchema(evaluator.inputSchema);
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

  const onSubmit = () =>
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

  return (
    <ProjectDecisionEvaluatorLayout
      title={title}
      submitLabel="create"
      projectId={projectId}
      scope={scope}
      variables={variables}
      decision={{ decisionEvaluatorId: evaluator.id }}
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
  const [defaultDraft] = useState(createProjectDecisionDraft);
  return (
    <DecisionEvaluatorDraftProvider defaultDraft={defaultDraft}>
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
          }
        }
      }
    `);
  const [isFilterValid, setIsFilterValid] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const onSubmit = async () => {
    setSubmitError(undefined);
    try {
      const input = await buildUpdateInput(
        store.getState().evaluator.globalName
      );
      setIsSubmitting(true);
      await commitAsync(update, {
        input: {
          ...input,
          projectEvaluatorId,
          ...getBindingFields(scope),
        },
      });
      notifySuccess({ title: "Evaluator updated" });
      void revalidate();
      onClose();
    } catch (error) {
      setSubmitError(getMutationErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

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
        isSubmitting={isSubmitting}
        isSubmitDisabled={draft.isLoading || !draft.isVersionReady}
        isFilterValid={isFilterValid}
        error={submitError ?? draft.loadError}
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
