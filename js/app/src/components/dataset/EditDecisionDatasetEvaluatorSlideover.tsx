import { Suspense, useMemo, useState } from "react";
import {
  fetchQuery,
  graphql,
  useLazyLoadQuery,
  useMutation,
  useRelayEnvironment,
} from "react-relay";
import invariant from "tiny-invariant";

import {
  Alert,
  Button,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import type { Annotation } from "@phoenix/components/annotation";
import { Dialog } from "@phoenix/components/core/dialog";
import { Loading } from "@phoenix/components/core/loading";
import type { ViewportModalOverlayProps } from "@phoenix/components/core/overlay";
import {
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components/core/overlay";
import type { EditDecisionDatasetEvaluatorSlideover_evaluatorQuery } from "@phoenix/components/dataset/__generated__/EditDecisionDatasetEvaluatorSlideover_evaluatorQuery.graphql";
import type { EditDecisionDatasetEvaluatorSlideover_patchJudgeMutation } from "@phoenix/components/dataset/__generated__/EditDecisionDatasetEvaluatorSlideover_patchJudgeMutation.graphql";
import type { EditDecisionDatasetEvaluatorSlideover_previewMutation } from "@phoenix/components/dataset/__generated__/EditDecisionDatasetEvaluatorSlideover_previewMutation.graphql";
import type { EditDecisionDatasetEvaluatorSlideover_updateBindingMutation } from "@phoenix/components/dataset/__generated__/EditDecisionDatasetEvaluatorSlideover_updateBindingMutation.graphql";
import type { EditDecisionDatasetEvaluatorSlideover_versionQuery } from "@phoenix/components/dataset/__generated__/EditDecisionDatasetEvaluatorSlideover_versionQuery.graphql";
import {
  commitAsync,
  getMutationErrorMessage,
  overrideSummary,
  policiesEqual,
  pruneBindingOverride,
  toBindingPolicyInput,
  toDecisionJudgeView,
} from "@phoenix/components/dataset/decisionDatasetEvaluatorUtils";
import type {
  DecisionProjectionPolicyValue,
  DecisionQuestionDefinition,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import {
  buildDefaultPolicy,
  isPolicyValid,
  normalizePolicy,
  policyOutputToInput,
  toDecisionQuestionDefinitions,
  validatePolicy,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import { DecisionProjectionPolicyEditor } from "@phoenix/components/evaluators/decision/DecisionProjectionPolicyEditor";
import { DecisionScoringDisclosure } from "@phoenix/components/evaluators/decision/DecisionScoringDisclosure";
import { EvaluatorExampleDataset } from "@phoenix/components/evaluators/EvaluatorExampleDataset";
import { EvaluatorFormDialogContent } from "@phoenix/components/evaluators/EvaluatorFormDialogContent";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorInputPreview } from "@phoenix/components/evaluators/EvaluatorInputPreview";
import { CodeEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/CodeEvaluatorInputVariablesProvider";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import {
  AnnotationPreviewCard,
  AnnotationPreviewSkeletonCard,
} from "@phoenix/components/evaluators/EvaluatorOutputPreview";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import { normalizeInputMapping } from "@phoenix/components/evaluators/utils";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  EvaluatorStoreProvider,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import { DecisionVersionSelector } from "@phoenix/pages/playground/DecisionVersionSelector";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import {
  DEFAULT_STORE_VALUES,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";

type EditDecisionDatasetEvaluatorSlideoverProps = {
  datasetEvaluatorId?: string;
  datasetId: string;
  updateConnectionIds?: string[];
  onUpdate?: () => void;
} & Omit<ViewportModalOverlayProps, "children">;

export const EditDecisionDatasetEvaluatorSlideover = ({
  datasetEvaluatorId,
  datasetId,
  updateConnectionIds,
  onUpdate,
  ...props
}: EditDecisionDatasetEvaluatorSlideoverProps) => {
  return (
    <ViewportModalOverlay {...props}>
      <ViewportModal size="fullscreen">
        <Dialog aria-label="Edit decision evaluator">
          {({ close }) => (
            <Suspense fallback={<Loading />}>
              {!!datasetEvaluatorId && (
                <EditDecisionEvaluatorDialog
                  datasetEvaluatorId={datasetEvaluatorId}
                  datasetId={datasetId}
                  updateConnectionIds={updateConnectionIds}
                  onClose={close}
                  onUpdate={onUpdate}
                />
              )}
            </Suspense>
          )}
        </Dialog>
      </ViewportModal>
    </ViewportModalOverlay>
  );
};

type EditDecisionEvaluatorDialogProps = {
  datasetEvaluatorId: string;
  datasetId: string;
  updateConnectionIds?: string[];
  onClose: () => void;
  onUpdate?: () => void;
};

type PinnedVersion = {
  versionId: string;
  sequenceNumber: number | null;
  questions: DecisionQuestionDefinition[];
  variables: string[];
};

const EditDecisionEvaluatorDialog = (
  props: EditDecisionEvaluatorDialogProps
) => {
  const { datasetEvaluatorId, datasetId } = props;
  const data =
    useLazyLoadQuery<EditDecisionDatasetEvaluatorSlideover_evaluatorQuery>(
      graphql`
        query EditDecisionDatasetEvaluatorSlideover_evaluatorQuery(
          $datasetId: ID!
          $datasetEvaluatorId: ID!
        ) {
          dataset: node(id: $datasetId) {
            ... on Dataset {
              datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {
                id
                name
                description
                inputMapping {
                  literalMapping
                  pathMapping
                }
                decisionProjectionPolicy {
                  questions {
                    __typename
                    name
                    optimizationDirection
                    ... on DecisionPredicateProjection {
                      threshold
                    }
                    ... on DecisionChoiceProjection {
                      scores {
                        choice
                        score
                      }
                    }
                    ... on DecisionScaleProjection {
                      includeLabel
                    }
                  }
                }
                evaluator {
                  __typename
                  id
                  name
                  ... on DecisionEvaluator {
                    inputSchema
                    datasetEvaluators {
                      id
                    }
                    projectionPolicy {
                      questions {
                        __typename
                        name
                        optimizationDirection
                        ... on DecisionPredicateProjection {
                          threshold
                        }
                        ... on DecisionChoiceProjection {
                          scores {
                            choice
                            score
                          }
                        }
                        ... on DecisionScaleProjection {
                          includeLabel
                        }
                      }
                    }
                    decisionVersion {
                      id
                      sequenceNumber
                      decision {
                        id
                        name
                      }
                      questions {
                        __typename
                        ... on DecisionPredicateQuestion {
                          name
                        }
                        ... on DecisionChoiceQuestion {
                          name
                          choices {
                            value
                          }
                        }
                        ... on DecisionScaleQuestion {
                          name
                          levels {
                            label
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
      { datasetEvaluatorId, datasetId },
      { fetchPolicy: "network-only" }
    );
  const datasetEvaluator = data.dataset.datasetEvaluator;
  invariant(datasetEvaluator != null, "datasetEvaluator is required");
  const judge = datasetEvaluator.evaluator;
  invariant(
    judge.__typename === "DecisionEvaluator" &&
      judge.projectionPolicy &&
      judge.decisionVersion,
    "a decision evaluator is required"
  );
  const initialState = useMemo(
    () =>
      ({
        ...DEFAULT_STORE_VALUES,
        evaluator: {
          ...DEFAULT_STORE_VALUES.evaluator,
          id: judge.id,
          globalName: judge.name,
          name: datasetEvaluator.name,
          description: datasetEvaluator.description ?? "",
          kind: "DECISION",
          isBuiltin: false,
          inputMapping: {
            literalMapping: {
              ...(datasetEvaluator.inputMapping.literalMapping as Record<
                string,
                never
              >),
            },
            pathMapping: {
              ...(datasetEvaluator.inputMapping.pathMapping as Record<
                string,
                string
              >),
            },
          },
        },
        datasetEvaluator: { id: datasetEvaluatorId },
        outputConfigs: [],
        dataset: {
          readonly: true,
          id: datasetId,
          selectedExampleId: null,
          selectedSplitIds: [],
        },
      }) satisfies EvaluatorStoreProps,
    [datasetEvaluator, judge, datasetEvaluatorId, datasetId]
  );
  return (
    <EvaluatorStoreProvider initialState={initialState}>
      <EditDecisionEvaluatorDialogContent
        {...props}
        datasetEvaluator={datasetEvaluator}
        judge={{
          id: judge.id,
          name: judge.name,
          inputSchema: judge.inputSchema,
          projectionPolicy: judge.projectionPolicy,
          decisionVersion: judge.decisionVersion,
        }}
        otherBindingCount={Math.max(
          0,
          (judge.datasetEvaluators?.length ?? 1) - 1
        )}
      />
    </EvaluatorStoreProvider>
  );
};

type DatasetEvaluatorData = NonNullable<
  EditDecisionDatasetEvaluatorSlideover_evaluatorQuery["response"]["dataset"]["datasetEvaluator"]
>;

const EditDecisionEvaluatorDialogContent = ({
  datasetEvaluatorId,
  updateConnectionIds,
  onClose,
  onUpdate,
  datasetEvaluator,
  judge,
  otherBindingCount,
}: EditDecisionEvaluatorDialogProps & {
  datasetEvaluator: DatasetEvaluatorData;
  judge: Parameters<typeof toDecisionJudgeView>[0];
  otherBindingCount: number;
}) => {
  const store = useEvaluatorStoreInstance();
  const environment = useRelayEnvironment();
  const notifySuccess = useNotifySuccess();
  const [patchJudge] =
    useMutation<EditDecisionDatasetEvaluatorSlideover_patchJudgeMutation>(
      graphql`
        mutation EditDecisionDatasetEvaluatorSlideover_patchJudgeMutation(
          $input: PatchDecisionEvaluatorInput!
        ) {
          patchDecisionEvaluator(input: $input) {
            evaluator {
              id
              inputSchema
              projectionPolicy {
                questions {
                  __typename
                  name
                  optimizationDirection
                  ... on DecisionPredicateProjection {
                    threshold
                  }
                  ... on DecisionChoiceProjection {
                    scores {
                      choice
                      score
                    }
                  }
                  ... on DecisionScaleProjection {
                    includeLabel
                  }
                }
              }
              decisionVersion {
                id
                sequenceNumber
              }
            }
          }
        }
      `
    );
  const [updateBinding] =
    useMutation<EditDecisionDatasetEvaluatorSlideover_updateBindingMutation>(
      graphql`
        mutation EditDecisionDatasetEvaluatorSlideover_updateBindingMutation(
          $input: UpdateDatasetDecisionEvaluatorInput!
          $connectionIds: [ID!]!
        ) {
          updateDatasetDecisionEvaluator(input: $input) {
            evaluator
              @appendNode(
                connections: $connectionIds
                edgeTypeName: "DatasetEvaluatorEdge"
              ) {
              id
              name
              description
              ...DatasetEvaluatorsTable_row
              ...PlaygroundDatasetSection_evaluator
              ...DecisionDatasetEvaluatorDetails_datasetEvaluator
            }
          }
        }
      `
    );

  const judgeView = useMemo(() => toDecisionJudgeView(judge), [judge]);
  // What the judge is saved as. Moves forward when the judge is patched, so a
  // retry after a failed binding update does not patch the judge again.
  const [savedJudge, setSavedJudge] = useState<{
    versionId: string;
    policy: DecisionProjectionPolicyValue;
  }>({ versionId: judge.decisionVersion.id, policy: judgeView.policy });
  const [pinned, setPinned] = useState<PinnedVersion>({
    versionId: judge.decisionVersion.id,
    sequenceNumber: judge.decisionVersion.sequenceNumber,
    questions: judgeView.questions,
    variables: judgeView.variables,
  });
  const [judgePolicy, setJudgePolicy] = useState<DecisionProjectionPolicyValue>(
    judgeView.policy
  );
  const [bindingOverride, setBindingOverride] =
    useState<DecisionProjectionPolicyValue | null>(() =>
      datasetEvaluator.decisionProjectionPolicy
        ? toBindingPolicyInput(
            policyOutputToInput(datasetEvaluator.decisionProjectionPolicy)
          )
        : null
    );
  const [versionError, setVersionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showValidationError, setShowValidationError] = useState(false);

  const effectiveJudgePolicy = useMemo(
    () => normalizePolicy(pinned.questions, judgePolicy),
    [pinned.questions, judgePolicy]
  );
  const isVersionChanged = pinned.versionId !== savedJudge.versionId;
  const isJudgePolicyChanged = !policiesEqual(
    effectiveJudgePolicy,
    normalizePolicy(pinned.questions, savedJudge.policy)
  );
  const isJudgeChanged = isVersionChanged || isJudgePolicyChanged;

  const selectVersion = async (version: {
    versionId?: string;
    tagName?: string;
  }) => {
    setVersionError(null);
    try {
      const result =
        await fetchQuery<EditDecisionDatasetEvaluatorSlideover_versionQuery>(
          environment,
          graphql`
            query EditDecisionDatasetEvaluatorSlideover_versionQuery(
              $decisionId: ID!
              $versionId: ID
              $tagName: Identifier
            ) {
              decision: node(id: $decisionId) {
                ... on Decision {
                  version(versionId: $versionId, tagName: $tagName) {
                    id
                    sequenceNumber
                    inputs {
                      name
                    }
                    questions {
                      __typename
                      ... on DecisionPredicateQuestion {
                        name
                      }
                      ... on DecisionChoiceQuestion {
                        name
                        choices {
                          value
                        }
                      }
                      ... on DecisionScaleQuestion {
                        name
                        levels {
                          label
                        }
                      }
                    }
                  }
                }
              }
            }
          `,
          {
            decisionId: judge.decisionVersion.decision.id,
            versionId: version.versionId ?? null,
            tagName: version.tagName ?? null,
          },
          { fetchPolicy: "network-only" }
        ).toPromise();
      const next = result?.decision?.version;
      if (!next) {
        setVersionError("That decision version could not be loaded.");
        return;
      }
      const questions = toDecisionQuestionDefinitions(next.questions);
      const variables = next.inputs.map(({ name }) => name);
      const { evaluator, setPathMapping, setLiteralMapping } = store.getState();
      const declaredNames = new Set(variables);
      setPathMapping(
        Object.fromEntries(
          Object.entries(evaluator.inputMapping.pathMapping).filter(([name]) =>
            declaredNames.has(name)
          )
        )
      );
      setLiteralMapping(
        Object.fromEntries(
          Object.entries(evaluator.inputMapping.literalMapping).filter(
            ([name]) => declaredNames.has(name)
          )
        )
      );
      setPinned({
        versionId: next.id,
        sequenceNumber: next.sequenceNumber,
        questions,
        variables,
      });
      setJudgePolicy((current) => normalizePolicy(questions, current));
      setBindingOverride((current) => pruneBindingOverride(current, questions));
    } catch (e) {
      setVersionError(getMutationErrorMessage(e));
    }
  };

  const onSubmit = async () => {
    setError(undefined);
    const isValid = await store.getState().validateAll();
    if (!isValid) {
      setShowValidationError(true);
      return;
    }
    setShowValidationError(false);
    if (
      !isPolicyValid(validatePolicy(effectiveJudgePolicy)) ||
      !isPolicyValid(validatePolicy(bindingOverride ?? { questions: [] }))
    ) {
      setError("Fix the scoring settings highlighted below before saving.");
      return;
    }
    setIsSubmitting(true);
    const { evaluator } = store.getState();
    const result = await runUpdateDecisionEvaluator({
      judgePatch: isJudgeChanged
        ? {
            evaluatorId: judge.id,
            ...(isVersionChanged
              ? { decisionVersionId: pinned.versionId }
              : {}),
            // A new version can declare other questions, so its policy is
            // always sent fitted to them.
            projectionPolicy: effectiveJudgePolicy,
          }
        : null,
      binding: {
        datasetEvaluatorId,
        name: evaluator.name,
        description: evaluator.description.trim(),
        inputMapping: normalizeInputMapping(evaluator.inputMapping),
        // Null restores inheritance of every question.
        projectionPolicy: toBindingPolicyInput(
          pruneBindingOverride(bindingOverride, pinned.questions)
        ),
      },
      connectionIds: updateConnectionIds ?? [],
      commitJudge: (input) =>
        commitAsync(patchJudge, { input }).then(() => undefined),
      commitBinding: (input, connectionIds) =>
        commitAsync(updateBinding, { input, connectionIds }).then(
          () => undefined
        ),
    });
    if (result.isJudgeSaved) {
      setSavedJudge({
        versionId: pinned.versionId,
        policy: effectiveJudgePolicy,
      });
    }
    setIsSubmitting(false);
    if (result.ok) {
      notifySuccess({ title: "Evaluator updated" });
      onUpdate?.();
      onClose();
    } else {
      setError(result.message);
    }
  };

  const decisionName = judge.decisionVersion.decision.name;
  const left = (
    <Flex direction="column" gap="size-300">
      <EvaluatorNameAndDescriptionFields isNameRequired />
      <section aria-label="Input mapping">
        <Flex direction="column" gap="size-150">
          <EvaluatorSectionHeader
            title="Input mapping"
            description="Map the judge's inputs to fields of the dataset example, the task output, and the reference output."
          />
          <EvaluatorInputMapping key={pinned.versionId} />
        </Flex>
      </section>
      <section aria-label="Scoring for this dataset">
        <DecisionScoringDisclosure
          id="decision-binding-scoring"
          title="Scoring for this dataset"
          description="Optional. Override how this dataset scores a question; every other question keeps the judge's settings."
          summary={overrideSummary(bindingOverride)}
          defaultExpanded={(bindingOverride?.questions.length ?? 0) > 0}
        >
          <DecisionProjectionPolicyEditor
            questions={pinned.questions}
            value={bindingOverride}
            inheritedPolicy={effectiveJudgePolicy}
            onChange={(next) => setBindingOverride(toBindingPolicyInput(next))}
            isDisabled={isSubmitting}
          />
        </DecisionScoringDisclosure>
      </section>
      <section aria-label="Decision judge">
        <Flex direction="column" gap="size-150">
          <EvaluatorSectionHeader
            title={`Decision judge: ${judge.name}`}
            description={`Runs the decision ${decisionName}.`}
          />
          <Alert
            variant="warning"
            title="Changes here affect every dataset using this judge"
            data-testid="decision-evaluator-judge-warning"
          >
            {otherBindingCount > 0
              ? `${otherBindingCount} other ${otherBindingCount === 1 ? "dataset evaluator uses" : "dataset evaluators use"} this judge. `
              : ""}
            Changing the judge&apos;s version or scoring applies to all of its
            dataset evaluators. Changes that would break an existing evaluator
            are refused, and the error names the evaluators affected.
          </Alert>
          {versionError ? <Alert variant="danger">{versionError}</Alert> : null}
          <Flex direction="row" gap="size-100" alignItems="center" wrap>
            <Text>Version</Text>
            <DecisionVersionSelector
              sequenceNumber={pinned.sequenceNumber}
              decision={{
                id: judge.decisionVersion.decision.id,
                name: decisionName,
                versionId: pinned.versionId,
                tag: null,
              }}
              onSelectVersion={(versionId) => void selectVersion({ versionId })}
              onSelectTag={(tagName) => void selectVersion({ tagName })}
            />
            {isVersionChanged ? (
              <Text size="S" color="text-700">
                Not saved yet
              </Text>
            ) : null}
          </Flex>
          <DecisionScoringDisclosure
            id="decision-judge-scoring"
            title="Judge scoring"
            summary={
              policiesEqual(
                effectiveJudgePolicy,
                buildDefaultPolicy(pinned.questions)
              )
                ? "Defaults"
                : "Customized"
            }
          >
            <DecisionProjectionPolicyEditor
              questions={pinned.questions}
              value={effectiveJudgePolicy}
              onChange={setJudgePolicy}
              isDisabled={isSubmitting}
            />
          </DecisionScoringDisclosure>
        </Flex>
      </section>
    </Flex>
  );

  const right = (
    <Flex direction="column" gap="size-200">
      <View paddingX="size-200">
        <Flex direction="column" gap="size-100">
          <DecisionJudgePreview
            judgeId={judge.id}
            datasetEvaluatorId={datasetEvaluatorId}
            isJudgeChanged={isJudgeChanged}
          />
          <EvaluatorExampleDataset />
        </Flex>
      </View>
      <EvaluatorInputPreview />
    </Flex>
  );

  return (
    <EvaluatorFormDialogContent
      title="Edit Decision Evaluator"
      submitLabel="Update"
      onSubmit={() => void onSubmit()}
      isSubmitting={isSubmitting}
      error={error}
      errorTitle="Failed to update evaluator"
      banner={
        showValidationError ? (
          <Alert
            variant="danger"
            title="Please fix the highlighted errors before submitting."
          />
        ) : null
      }
      left={left}
      right={right}
      renderInputVariables={(form) => (
        <CodeEvaluatorInputVariablesProvider variables={pinned.variables}>
          {form}
        </CodeEvaluatorInputVariablesProvider>
      )}
      submitButtonProps={{
        "data-testid": "decision-evaluator-form-submit-button",
        "data-mode": "update",
      }}
    />
  );
};

type PatchJudgeInput =
  EditDecisionDatasetEvaluatorSlideover_patchJudgeMutation["variables"]["input"];
type UpdateBindingInput =
  EditDecisionDatasetEvaluatorSlideover_updateBindingMutation["variables"]["input"];

/**
 * Saves the judge first, then the binding. The server refuses a judge change
 * that would break a dataset using it; nothing about this binding saves then.
 * Never throws; `isJudgeSaved` tells the caller the judge change landed even
 * when the binding update failed, so a retry does not patch it again.
 */
async function runUpdateDecisionEvaluator({
  judgePatch,
  binding,
  connectionIds,
  commitJudge,
  commitBinding,
}: {
  judgePatch: PatchJudgeInput | null;
  binding: UpdateBindingInput;
  connectionIds: string[];
  commitJudge: (input: PatchJudgeInput) => Promise<void>;
  commitBinding: (
    input: UpdateBindingInput,
    connectionIds: string[]
  ) => Promise<void>;
}): Promise<
  | { ok: true; isJudgeSaved: boolean }
  | { ok: false; message: string; isJudgeSaved: boolean }
> {
  let isJudgeSaved = false;
  if (judgePatch) {
    const judgeError = await commitJudge(judgePatch).then(
      () => null,
      (e: unknown) => e
    );
    if (judgeError) {
      return {
        ok: false,
        message: getMutationErrorMessage(judgeError),
        isJudgeSaved,
      };
    }
    isJudgeSaved = true;
  }
  const bindingError = await commitBinding(binding, connectionIds).then(
    () => null,
    (e: unknown) => e
  );
  if (bindingError) {
    return {
      ok: false,
      message: getMutationErrorMessage(bindingError),
      isJudgeSaved,
    };
  }
  return { ok: true, isJudgeSaved };
}

type PreviewResult =
  | { kind: "success"; annotation: Annotation }
  | { kind: "error"; evaluatorName: string; message: string };

/**
 * Runs the saved judge on the selected example as this dataset's evaluator, so
 * it is named and scored as experiments run it: with the saved version, the
 * judge's saved scoring, and this dataset's saved override. Unsaved edits made
 * in this dialog are not used.
 */
const DecisionJudgePreview = ({
  judgeId,
  datasetEvaluatorId,
  isJudgeChanged,
}: {
  judgeId: string;
  datasetEvaluatorId: string;
  isJudgeChanged: boolean;
}) => {
  const store = useEvaluatorStoreInstance();
  const credentials = useCredentialsContext((state) => state);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PreviewResult[]>([]);
  const [preview, isPreviewing] =
    useMutation<EditDecisionDatasetEvaluatorSlideover_previewMutation>(graphql`
      mutation EditDecisionDatasetEvaluatorSlideover_previewMutation(
        $input: EvaluatorPreviewsInput!
      ) {
        evaluatorPreviews(input: $input) {
          results {
            evaluatorName
            annotation {
              id
              name
              label
              score
              explanation
            }
            error
          }
        }
      }
    `);
  const onTest = () => {
    setError(null);
    setResults([]);
    const state = store.getState();
    preview({
      variables: {
        input: {
          previews: [
            {
              context: state.evaluatorMappingSource.source,
              evaluator: { decisionEvaluatorId: judgeId },
              datasetEvaluatorId,
              inputMapping: normalizeInputMapping(state.evaluator.inputMapping),
            },
          ],
          credentials: toGqlCredentials(credentials),
        },
      },
      onCompleted: (response, errors) => {
        if (errors && errors.length > 0) {
          setError(errors.map(({ message }) => message).join("\n"));
          return;
        }
        setResults(
          response.evaluatorPreviews.results.map((result): PreviewResult => {
            if (result.error != null) {
              return {
                kind: "error",
                evaluatorName: result.evaluatorName,
                message: result.error,
              };
            }
            if (result.annotation == null) {
              return {
                kind: "error",
                evaluatorName: result.evaluatorName,
                message: "The judge returned no annotation.",
              };
            }
            return { kind: "success", annotation: result.annotation };
          })
        );
      },
      onError: (e) => setError(getMutationErrorMessage(e)),
    });
  };
  return (
    <Flex direction="column" gap="size-100">
      <Flex justifyContent="space-between" alignItems="center">
        <Text weight="heavy" elementType="h3">
          Test with an Example
        </Text>
        <Button
          size="S"
          variant="primary"
          onPress={onTest}
          isPending={isPreviewing}
          leadingVisual={
            <Icon
              svg={isPreviewing ? <Icons.Loading /> : <Icons.PlayCircle />}
            />
          }
          data-testid="decision-evaluator-preview-button"
        >
          {isPreviewing ? "Testing..." : "Test"}
        </Button>
      </Flex>
      <Text color="text-500">
        The test runs the judge as this dataset&apos;s evaluator, with its saved
        version and scoring, this dataset&apos;s saved scoring, and the input
        mapping below.{" "}
        {isJudgeChanged ? "Your unsaved changes are not used." : ""}
      </Text>
      {isPreviewing ? <AnnotationPreviewSkeletonCard /> : null}
      {results.map((result, index) =>
        result.kind === "success" ? (
          <AnnotationPreviewCard key={index} annotation={result.annotation} />
        ) : (
          <Alert
            key={index}
            variant="danger"
            title={`Evaluator Error: ${result.evaluatorName}`}
          >
            {result.message}
          </Alert>
        )
      )}
      {error ? (
        <Alert
          variant="danger"
          title="Error"
          dismissable
          onDismissClick={() => setError(null)}
        >
          {error}
        </Alert>
      ) : null}
    </Flex>
  );
};
