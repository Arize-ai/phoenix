import { type ReactNode, useState } from "react";
import { graphql, useMutation, useRelayEnvironment } from "react-relay";
import { useRevalidator } from "react-router";

import { Alert, Flex, Heading, Text, View } from "@phoenix/components";
import { useTimeRange } from "@phoenix/components/datetime";
import { DecisionEvaluatorDefinitionFields } from "@phoenix/components/evaluators/decision/DecisionEvaluatorDefinitionFields";
import { DecisionEvaluatorDraftProvider } from "@phoenix/components/evaluators/decision/DecisionEvaluatorDraftProvider";
import {
  commitAsync,
  type DecisionEvaluatorData,
  getMutationErrorMessage,
  inputNamesFromSchema,
  pickDeclaredInputMapping,
} from "@phoenix/components/evaluators/decision/decisionEvaluatorUtils";
import {
  type DecisionEvaluatorDraft,
  useDecisionEvaluatorDraft,
} from "@phoenix/components/evaluators/decision/useDecisionEvaluatorDraft";
import { EvaluatorFormDialogContent } from "@phoenix/components/evaluators/EvaluatorFormDialogContent";
import { CodeEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/CodeEvaluatorInputVariablesProvider";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import { createDecisionQuestion } from "@phoenix/pages/playground/decisionUtils";
import type { ProjectDecisionEvaluatorDialogContentCreateMutation } from "@phoenix/pages/project/evaluators/__generated__/ProjectDecisionEvaluatorDialogContentCreateMutation.graphql";
import type { ProjectDecisionEvaluatorDialogContentUpdateMutation } from "@phoenix/pages/project/evaluators/__generated__/ProjectDecisionEvaluatorDialogContentUpdateMutation.graphql";
import {
  ProjectEvaluatorInputMappingDock,
  ProjectEvaluatorScopeSection,
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
import {
  type EvaluatorFormDirtyCheck,
  useEvaluatorFormDirtyCheck,
} from "@phoenix/pages/project/evaluators/useEvaluatorFormDirtyCheck";
import type { DecisionPromptDraft } from "@phoenix/store/playground";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

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

const SCORING_DESCRIPTION =
  "Turn each answer into the score this evaluator records.";

function createProjectDecisionDraft(): DecisionPromptDraft {
  return {
    state: "Request:\n{{input}}\n\nResponse:\n{{output}}",
    stateEditorMode: "text",
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

function useDeclaredInputMapping(variables: readonly string[]) {
  const store = useEvaluatorStoreInstance();
  return () =>
    pickDeclaredInputMapping(
      store.getState().evaluator.inputMapping,
      variables
    );
}

function useFinishCreate({ projectId, onSuccess }: ScopeProps & DialogProps) {
  const environment = useRelayEnvironment();
  const { timeRangeISOStrings } = useTimeRange();
  return async () => {
    await refetchProjectEvaluators({
      environment,
      projectId,
      timeRange: timeRangeISOStrings,
    });
    onSuccess();
  };
}

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

function CreateProjectDecisionEvaluatorForm(props: DialogProps) {
  const { title, projectId, scope, onScopeChange, registerDirtyCheck } = props;
  const store = useEvaluatorStoreInstance();
  const draft = useDecisionEvaluatorDraft({});
  const [create] =
    useMutation<ProjectDecisionEvaluatorDialogContentCreateMutation>(
      createMutation
    );
  const getInputMapping = useDeclaredInputMapping(draft.variables);
  const finish = useFinishCreate(props);
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
    if (!(await store.getState().validateAll())) {
      setSubmitError("Fix the highlighted fields before saving.");
      return;
    }
    const state = store.getState();
    const name = state.evaluator.globalName.trim();
    try {
      if (validateIdentifier(name) !== true)
        throw new Error("Enter a valid evaluator name.");
      draft.getDefinition(name);
      setIsSubmitting(true);
      await commitAsync(create, {
        input: {
          projectId,
          name,
          evaluatorName: name,
          description: state.evaluator.description.trim() || null,
          inputMapping: getInputMapping(),
          ...draft.getCreateDecisionSource(),
          scoringPolicy: draft.policy,
          ...getBindingFields(scope),
          enabled: true,
        },
      });
      await finish();
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
        <>
          <EvaluatorNameAndDescriptionFields isNameRequired />
          <ProjectEvaluatorScopeSection
            projectId={projectId}
            scope={scope}
            onScopeChange={onScopeChange}
            onFilterValidityChange={setIsFilterValid}
          />
          <Flex direction="column" gap="size-200">
            <DecisionEvaluatorDefinitionFields
              draft={draft}
              isDisabled={isSubmitting}
              scoringDescription={SCORING_DESCRIPTION}
            />
          </Flex>
        </>
      }
    />
  );
}

export function AttachProjectDecisionEvaluatorDialogContent({
  evaluator,
  ...props
}: DialogProps & { evaluator: DecisionEvaluatorData }) {
  const { title, projectId, scope, onScopeChange, registerDirtyCheck } = props;
  const store = useEvaluatorStoreInstance();
  const variables = inputNamesFromSchema(evaluator.inputSchema);
  const [create, isCreating] =
    useMutation<ProjectDecisionEvaluatorDialogContentCreateMutation>(
      createMutation
    );
  const getInputMapping = useDeclaredInputMapping(variables);
  const finish = useFinishCreate(props);
  const [isFilterValid, setIsFilterValid] = useState(true);
  const [submitError, setSubmitError] = useState<string>();
  const trackStoreForDirtyCheck = useEvaluatorFormDirtyCheck({
    registerDirtyCheck,
    scope,
  });
  trackStoreForDirtyCheck(store);

  const onSubmit = async () => {
    setSubmitError(undefined);
    try {
      await commitAsync(create, {
        input: {
          projectId,
          evaluatorId: evaluator.id,
          name: evaluator.name,
          inputMapping: getInputMapping(),
          ...getBindingFields(scope),
          enabled: true,
        },
      });
      await finish();
    } catch (error) {
      setSubmitError(getMutationErrorMessage(error));
    }
  };

  return (
    <ProjectDecisionEvaluatorLayout
      title={title}
      submitLabel="create"
      projectId={projectId}
      scope={scope}
      variables={variables}
      decision={{ decisionEvaluatorId: evaluator.id }}
      isSubmitting={isCreating}
      isSubmitDisabled={false}
      isFilterValid={isFilterValid}
      error={submitError}
      onSubmit={() => void onSubmit()}
      definition={
        <>
          <View marginBottom="size-200" flex="none">
            <Flex direction="column" gap="size-100">
              <EvaluatorSectionHeader
                title="Evaluator"
                description="Attach the selected decision evaluator to this project."
              />
              <View
                borderRadius="medium"
                borderWidth="thin"
                borderColor="default"
                padding="size-200"
              >
                <Flex direction="column" gap="size-50">
                  <Heading level={3}>{evaluator.name}</Heading>
                  <Text size="S" color="text-500">
                    {evaluator.decisionVersion.decision.name}
                  </Text>
                </Flex>
              </View>
            </Flex>
          </View>
          <ProjectEvaluatorScopeSection
            projectId={projectId}
            scope={scope}
            onScopeChange={onScopeChange}
            onFilterValidityChange={setIsFilterValid}
          />
        </>
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
  const getInputMapping = useDeclaredInputMapping(draft.variables);
  const [isFilterValid, setIsFilterValid] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const onSubmit = async () => {
    setSubmitError(undefined);
    if (!(await store.getState().validateAll())) {
      setSubmitError("Fix the highlighted fields before saving.");
      return;
    }
    const state = store.getState();
    try {
      draft.getDefinition(state.evaluator.globalName);
      setIsSubmitting(true);
      await commitAsync(update, {
        input: {
          projectEvaluatorId,
          name: state.evaluator.globalName.trim(),
          description: state.evaluator.description.trim() || null,
          inputMapping: getInputMapping(),
          ...draft.getUpdateDecisionSource(),
          scoringPolicy: draft.policy,
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
          <>
            <EvaluatorNameAndDescriptionFields isNameRequired />
            <ProjectEvaluatorScopeSection
              projectId={projectId}
              scope={scope}
              onScopeChange={onScopeChange}
              onFilterValidityChange={setIsFilterValid}
              isTargetDisabled
            />
            <Flex direction="column" gap="size-200">
              <Alert variant="warning" title="Shared evaluator">
                Decision and scoring changes affect every dataset and online
                evaluator using this evaluator. Saving definition changes
                creates a new Decision version.
              </Alert>
              <DecisionEvaluatorDefinitionFields
                draft={draft}
                isDisabled={isSubmitting}
                scoringDescription={SCORING_DESCRIPTION}
              />
            </Flex>
          </>
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
