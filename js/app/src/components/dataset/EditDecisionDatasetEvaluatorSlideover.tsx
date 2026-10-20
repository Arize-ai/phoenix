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
import type { EditDecisionDatasetEvaluatorSlideover_patchEvaluatorMutation } from "@phoenix/components/dataset/__generated__/EditDecisionDatasetEvaluatorSlideover_patchEvaluatorMutation.graphql";
import type { EditDecisionDatasetEvaluatorSlideover_previewMutation } from "@phoenix/components/dataset/__generated__/EditDecisionDatasetEvaluatorSlideover_previewMutation.graphql";
import type { EditDecisionDatasetEvaluatorSlideover_updateBindingMutation } from "@phoenix/components/dataset/__generated__/EditDecisionDatasetEvaluatorSlideover_updateBindingMutation.graphql";
import type { EditDecisionDatasetEvaluatorSlideover_versionQuery } from "@phoenix/components/dataset/__generated__/EditDecisionDatasetEvaluatorSlideover_versionQuery.graphql";
import {
  commitAsync,
  getMutationErrorMessage,
  policiesEqual,
  toDecisionEvaluatorView,
} from "@phoenix/components/dataset/decisionDatasetEvaluatorUtils";
import type {
  DecisionScoringPolicyValue,
  DecisionQuestionDefinition,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import {
  buildDefaultPolicy,
  isPolicyValid,
  normalizePolicy,
  toDecisionQuestionDefinitions,
  validatePolicy,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import { DecisionScoringDisclosure } from "@phoenix/components/evaluators/decision/DecisionScoringDisclosure";
import { DecisionScoringPolicyEditor } from "@phoenix/components/evaluators/decision/DecisionScoringPolicyEditor";
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
                evaluator {
                  __typename
                  id
                  name
                  ... on DecisionEvaluator {
                    inputSchema
                    datasetEvaluators {
                      id
                    }
                    scoringPolicy {
                      questions {
                        __typename
                        name
                        optimizationDirection
                        ... on DecisionPredicateScoring {
                          threshold
                        }
                        ... on DecisionChoiceScoring {
                          scores {
                            choice
                            score
                          }
                        }
                        ... on DecisionScaleScoring {
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
  const evaluator = datasetEvaluator.evaluator;
  invariant(
    evaluator.__typename === "DecisionEvaluator" &&
      evaluator.scoringPolicy &&
      evaluator.decisionVersion,
    "a decision evaluator is required"
  );
  const initialState = useMemo(
    () =>
      ({
        ...DEFAULT_STORE_VALUES,
        evaluator: {
          ...DEFAULT_STORE_VALUES.evaluator,
          id: evaluator.id,
          globalName: evaluator.name,
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
    [datasetEvaluator, evaluator, datasetEvaluatorId, datasetId]
  );
  return (
    <EvaluatorStoreProvider initialState={initialState}>
      <EditDecisionEvaluatorDialogContent
        {...props}
        evaluator={{
          id: evaluator.id,
          name: evaluator.name,
          inputSchema: evaluator.inputSchema,
          scoringPolicy: evaluator.scoringPolicy,
          decisionVersion: evaluator.decisionVersion,
        }}
        otherBindingCount={Math.max(
          0,
          (evaluator.datasetEvaluators?.length ?? 1) - 1
        )}
      />
    </EvaluatorStoreProvider>
  );
};

const EditDecisionEvaluatorDialogContent = ({
  datasetEvaluatorId,
  updateConnectionIds,
  onClose,
  onUpdate,
  evaluator,
  otherBindingCount,
}: EditDecisionEvaluatorDialogProps & {
  evaluator: Parameters<typeof toDecisionEvaluatorView>[0];
  otherBindingCount: number;
}) => {
  const store = useEvaluatorStoreInstance();
  const environment = useRelayEnvironment();
  const notifySuccess = useNotifySuccess();
  const [patchEvaluator] =
    useMutation<EditDecisionDatasetEvaluatorSlideover_patchEvaluatorMutation>(
      graphql`
        mutation EditDecisionDatasetEvaluatorSlideover_patchEvaluatorMutation(
          $input: PatchDecisionEvaluatorInput!
        ) {
          patchDecisionEvaluator(input: $input) {
            evaluator {
              id
              inputSchema
              scoringPolicy {
                questions {
                  __typename
                  name
                  optimizationDirection
                  ... on DecisionPredicateScoring {
                    threshold
                  }
                  ... on DecisionChoiceScoring {
                    scores {
                      choice
                      score
                    }
                  }
                  ... on DecisionScaleScoring {
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

  const evaluatorView = useMemo(
    () => toDecisionEvaluatorView(evaluator),
    [evaluator]
  );
  // What the evaluator is saved as. Moves forward when the evaluator is patched, so a
  // retry after a failed binding update does not patch the evaluator again.
  const [savedEvaluator, setSavedEvaluator] = useState<{
    versionId: string;
    policy: DecisionScoringPolicyValue;
  }>({ versionId: evaluator.decisionVersion.id, policy: evaluatorView.policy });
  const [pinned, setPinned] = useState<PinnedVersion>({
    versionId: evaluator.decisionVersion.id,
    sequenceNumber: evaluator.decisionVersion.sequenceNumber,
    questions: evaluatorView.questions,
    variables: evaluatorView.variables,
  });
  const [evaluatorPolicy, setEvaluatorPolicy] =
    useState<DecisionScoringPolicyValue>(evaluatorView.policy);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showValidationError, setShowValidationError] = useState(false);

  const effectiveEvaluatorPolicy = useMemo(
    () => normalizePolicy(pinned.questions, evaluatorPolicy),
    [pinned.questions, evaluatorPolicy]
  );
  const isVersionChanged = pinned.versionId !== savedEvaluator.versionId;
  const isEvaluatorPolicyChanged = !policiesEqual(
    effectiveEvaluatorPolicy,
    normalizePolicy(pinned.questions, savedEvaluator.policy)
  );
  const isEvaluatorChanged = isVersionChanged || isEvaluatorPolicyChanged;

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
            decisionId: evaluator.decisionVersion.decision.id,
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
      const {
        evaluator: draftEvaluator,
        setPathMapping,
        setLiteralMapping,
      } = store.getState();
      const declaredNames = new Set(variables);
      setPathMapping(
        Object.fromEntries(
          Object.entries(draftEvaluator.inputMapping.pathMapping).filter(
            ([name]) => declaredNames.has(name)
          )
        )
      );
      setLiteralMapping(
        Object.fromEntries(
          Object.entries(draftEvaluator.inputMapping.literalMapping).filter(
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
      setEvaluatorPolicy((current) => normalizePolicy(questions, current));
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
    if (!isPolicyValid(validatePolicy(effectiveEvaluatorPolicy))) {
      setError("Fix the scoring settings highlighted below before saving.");
      return;
    }
    setIsSubmitting(true);
    const { evaluator: draftEvaluator } = store.getState();
    const result = await runUpdateDecisionEvaluator({
      evaluatorPatch: isEvaluatorChanged
        ? {
            evaluatorId: evaluator.id,
            ...(isVersionChanged
              ? { decisionVersionId: pinned.versionId }
              : {}),
            // A new version can declare other questions, so its policy is
            // always adapted to them.
            scoringPolicy: effectiveEvaluatorPolicy,
          }
        : null,
      binding: {
        datasetEvaluatorId,
        name: draftEvaluator.name,
        description: draftEvaluator.description.trim(),
        inputMapping: normalizeInputMapping(draftEvaluator.inputMapping),
      },
      connectionIds: updateConnectionIds ?? [],
      commitEvaluator: (input) =>
        commitAsync(patchEvaluator, { input }).then(() => undefined),
      commitBinding: (input, connectionIds) =>
        commitAsync(updateBinding, { input, connectionIds }).then(
          () => undefined
        ),
    });
    if (result.isEvaluatorSaved) {
      setSavedEvaluator({
        versionId: pinned.versionId,
        policy: effectiveEvaluatorPolicy,
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

  const decisionName = evaluator.decisionVersion.decision.name;
  const left = (
    <Flex direction="column" gap="size-300">
      <EvaluatorNameAndDescriptionFields isNameRequired />
      <section aria-label="Input mapping">
        <Flex direction="column" gap="size-150">
          <EvaluatorSectionHeader
            title="Input mapping"
            description="Map the evaluator's inputs to fields of the dataset example, the task output, and the reference output."
          />
          <EvaluatorInputMapping key={pinned.versionId} />
        </Flex>
      </section>
      <section aria-label="Decision evaluator">
        <Flex direction="column" gap="size-150">
          <EvaluatorSectionHeader
            title={`Decision evaluator: ${evaluator.name}`}
            description={`Runs the decision ${decisionName}.`}
          />
          <Alert
            variant="warning"
            title="Changes here affect every dataset using this evaluator"
            data-testid="decision-evaluator-evaluator-warning"
          >
            {otherBindingCount > 0
              ? `${otherBindingCount} other ${otherBindingCount === 1 ? "dataset evaluator uses" : "dataset evaluators use"} this evaluator. `
              : ""}
            Changing the evaluator&apos;s version or scoring applies to all of
            its dataset evaluators. Changes that would break an existing
            evaluator are refused, and the error names the evaluators affected.
          </Alert>
          {versionError ? <Alert variant="danger">{versionError}</Alert> : null}
          <Flex direction="row" gap="size-100" alignItems="center" wrap>
            <Text>Version</Text>
            <DecisionVersionSelector
              sequenceNumber={pinned.sequenceNumber}
              decision={{
                id: evaluator.decisionVersion.decision.id,
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
            id="decision-evaluator-scoring"
            title="Evaluator scoring"
            summary={
              policiesEqual(
                effectiveEvaluatorPolicy,
                buildDefaultPolicy(pinned.questions)
              )
                ? "Defaults"
                : "Customized"
            }
          >
            <DecisionScoringPolicyEditor
              questions={pinned.questions}
              value={effectiveEvaluatorPolicy}
              onChange={setEvaluatorPolicy}
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
          <DecisionEvaluatorPreview
            evaluatorId={evaluator.id}
            datasetEvaluatorId={datasetEvaluatorId}
            isEvaluatorChanged={isEvaluatorChanged}
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

type PatchEvaluatorInput =
  EditDecisionDatasetEvaluatorSlideover_patchEvaluatorMutation["variables"]["input"];
type UpdateBindingInput =
  EditDecisionDatasetEvaluatorSlideover_updateBindingMutation["variables"]["input"];

/**
 * Saves the evaluator first, then the binding. The server refuses a evaluator change
 * that would break a dataset using it; nothing about this binding saves then.
 * Never throws; `isEvaluatorSaved` tells the caller the evaluator change landed even
 * when the binding update failed, so a retry does not patch it again.
 */
async function runUpdateDecisionEvaluator({
  evaluatorPatch,
  binding,
  connectionIds,
  commitEvaluator,
  commitBinding,
}: {
  evaluatorPatch: PatchEvaluatorInput | null;
  binding: UpdateBindingInput;
  connectionIds: string[];
  commitEvaluator: (input: PatchEvaluatorInput) => Promise<void>;
  commitBinding: (
    input: UpdateBindingInput,
    connectionIds: string[]
  ) => Promise<void>;
}): Promise<
  | { ok: true; isEvaluatorSaved: boolean }
  | { ok: false; message: string; isEvaluatorSaved: boolean }
> {
  let isEvaluatorSaved = false;
  if (evaluatorPatch) {
    const evaluatorError = await commitEvaluator(evaluatorPatch).then(
      () => null,
      (e: unknown) => e
    );
    if (evaluatorError) {
      return {
        ok: false,
        message: getMutationErrorMessage(evaluatorError),
        isEvaluatorSaved,
      };
    }
    isEvaluatorSaved = true;
  }
  const bindingError = await commitBinding(binding, connectionIds).then(
    () => null,
    (e: unknown) => e
  );
  if (bindingError) {
    return {
      ok: false,
      message: getMutationErrorMessage(bindingError),
      isEvaluatorSaved,
    };
  }
  return { ok: true, isEvaluatorSaved };
}

type PreviewResult =
  | { kind: "success"; annotation: Annotation }
  | { kind: "error"; evaluatorName: string; message: string };

/**
 * Runs the saved evaluator on the selected example as this dataset's evaluator, so
 * it is named and scored as experiments run it: with the saved version and the
 * evaluator's saved scoring. Unsaved edits made in this dialog are not used.
 */
const DecisionEvaluatorPreview = ({
  evaluatorId,
  datasetEvaluatorId,
  isEvaluatorChanged,
}: {
  evaluatorId: string;
  datasetEvaluatorId: string;
  isEvaluatorChanged: boolean;
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
              ...decisionAnnotation_annotation @relay(mask: false)
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
              evaluator: { decisionEvaluatorId: evaluatorId },
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
                message: "The evaluator returned no annotation.",
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
        The test runs the evaluator as this dataset&apos;s evaluator, with its
        saved version and scoring, this dataset&apos;s saved scoring, and the
        input mapping below.{" "}
        {isEvaluatorChanged ? "Your unsaved changes are not used." : ""}
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
