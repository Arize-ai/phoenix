import { Suspense, useCallback, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Alert,
  Button,
  Flex,
  Input,
  Label,
  ListBox,
  Popover,
  Radio,
  RadioGroup,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  View,
  FieldError,
} from "@phoenix/components";
import { Dialog } from "@phoenix/components/core/dialog";
import { TextField } from "@phoenix/components/core/field";
import { Loading } from "@phoenix/components/core/loading";
import type { ViewportModalOverlayProps } from "@phoenix/components/core/overlay";
import {
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components/core/overlay";
import type { CreateDecisionDatasetEvaluatorSlideover_createBindingMutation } from "@phoenix/components/dataset/__generated__/CreateDecisionDatasetEvaluatorSlideover_createBindingMutation.graphql";
import type { CreateDecisionDatasetEvaluatorSlideover_createEvaluatorMutation } from "@phoenix/components/dataset/__generated__/CreateDecisionDatasetEvaluatorSlideover_createEvaluatorMutation.graphql";
import type { CreateDecisionDatasetEvaluatorSlideover_evaluatorsQuery } from "@phoenix/components/dataset/__generated__/CreateDecisionDatasetEvaluatorSlideover_evaluatorsQuery.graphql";
import type { DecisionEvaluatorData } from "@phoenix/components/dataset/decisionDatasetEvaluatorUtils";
import {
  commitAsync,
  getMutationErrorMessage,
  evaluatorPolicySummary,
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
  validatePolicy,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import { DecisionScoringDisclosure } from "@phoenix/components/evaluators/decision/DecisionScoringDisclosure";
import { DecisionScoringPolicyEditor } from "@phoenix/components/evaluators/decision/DecisionScoringPolicyEditor";
import type { DecisionVersionSelection } from "@phoenix/components/evaluators/decision/DecisionVersionPicker";
import { DecisionVersionPicker } from "@phoenix/components/evaluators/decision/DecisionVersionPicker";
import { EvaluatorExampleDataset } from "@phoenix/components/evaluators/EvaluatorExampleDataset";
import { EvaluatorFormDialogContent } from "@phoenix/components/evaluators/EvaluatorFormDialogContent";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorInputPreview } from "@phoenix/components/evaluators/EvaluatorInputPreview";
import { CodeEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/CodeEvaluatorInputVariablesProvider";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import { normalizeInputMapping } from "@phoenix/components/evaluators/utils";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext/useEvaluatorStore";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import {
  DEFAULT_STORE_VALUES,
  type EvaluatorStoreProps,
} from "@phoenix/store/evaluatorStore";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

type EvaluatorSourceMode = "existing" | "new";

export const CreateDecisionDatasetEvaluatorSlideover = ({
  datasetId,
  updateConnectionIds,
  onEvaluatorCreated,
  ...props
}: {
  datasetId: string;
  updateConnectionIds?: string[];
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
} & Omit<ViewportModalOverlayProps, "children">) => {
  return (
    <ViewportModalOverlay {...props}>
      <ViewportModal size="fullscreen">
        <Dialog aria-label="Create decision evaluator">
          {({ close }) => (
            <Suspense fallback={<Loading />}>
              {datasetId && (
                <CreateDecisionEvaluatorDialog
                  onClose={close}
                  datasetId={datasetId}
                  updateConnectionIds={updateConnectionIds}
                  onEvaluatorCreated={onEvaluatorCreated}
                />
              )}
            </Suspense>
          )}
        </Dialog>
      </ViewportModal>
    </ViewportModalOverlay>
  );
};

type CreateDecisionEvaluatorDialogProps = {
  onClose: () => void;
  datasetId: string;
  updateConnectionIds?: string[];
  onEvaluatorCreated?: (datasetEvaluatorId: string) => void;
};

const CreateDecisionEvaluatorDialog = (
  props: CreateDecisionEvaluatorDialogProps
) => {
  const { datasetId } = props;
  const initialState = useMemo(
    () =>
      ({
        ...DEFAULT_STORE_VALUES,
        evaluator: {
          ...DEFAULT_STORE_VALUES.evaluator,
          kind: "DECISION",
          isBuiltin: false,
        },
        outputConfigs: [],
        dataset: {
          readonly: true,
          id: datasetId,
          selectedExampleId: null,
          selectedSplitIds: [],
        },
      }) satisfies EvaluatorStoreProps,
    [datasetId]
  );
  return (
    <EvaluatorStoreProvider initialState={initialState}>
      <CreateDecisionEvaluatorDialogContent {...props} />
    </EvaluatorStoreProvider>
  );
};

const CreateDecisionEvaluatorDialogContent = ({
  onClose,
  datasetId,
  updateConnectionIds,
  onEvaluatorCreated,
}: CreateDecisionEvaluatorDialogProps) => {
  const store = useEvaluatorStoreInstance();
  const notifySuccess = useNotifySuccess();
  const data =
    useLazyLoadQuery<CreateDecisionDatasetEvaluatorSlideover_evaluatorsQuery>(
      graphql`
        query CreateDecisionDatasetEvaluatorSlideover_evaluatorsQuery {
          evaluators(first: 200) {
            edges {
              evaluator: node {
                __typename
                id
                name
                ... on DecisionEvaluator {
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
      `,
      {},
      { fetchPolicy: "network-only" }
    );
  const [createEvaluator] =
    useMutation<CreateDecisionDatasetEvaluatorSlideover_createEvaluatorMutation>(
      graphql`
        mutation CreateDecisionDatasetEvaluatorSlideover_createEvaluatorMutation(
          $input: CreateDecisionEvaluatorInput!
        ) {
          createDecisionEvaluator(input: $input) {
            evaluator {
              id
              name
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
      `
    );
  const [createBinding] =
    useMutation<CreateDecisionDatasetEvaluatorSlideover_createBindingMutation>(
      graphql`
        mutation CreateDecisionDatasetEvaluatorSlideover_createBindingMutation(
          $input: CreateDatasetDecisionEvaluatorInput!
          $connectionIds: [ID!]!
        ) {
          createDatasetDecisionEvaluator(input: $input) {
            evaluator
              @appendNode(
                connections: $connectionIds
                edgeTypeName: "DatasetEvaluatorEdge"
              ) {
              id
              name
              ...PlaygroundDatasetSection_evaluator
              ...DatasetEvaluatorsTable_row
            }
          }
        }
      `
    );

  const evaluators = useMemo(
    () =>
      data.evaluators.edges.flatMap(({ evaluator }): DecisionEvaluatorData[] =>
        evaluator.__typename === "DecisionEvaluator" &&
        evaluator.scoringPolicy &&
        evaluator.decisionVersion
          ? [
              {
                id: evaluator.id,
                name: evaluator.name,
                inputSchema: evaluator.inputSchema,
                scoringPolicy: evaluator.scoringPolicy,
                decisionVersion: evaluator.decisionVersion,
              },
            ]
          : []
      ),
    [data]
  );

  const [evaluatorSourceMode, setEvaluatorSourceMode] =
    useState<EvaluatorSourceMode>(evaluators.length > 0 ? "existing" : "new");
  const [selectedEvaluatorId, setSelectedEvaluatorId] = useState<string | null>(
    null
  );
  const [newEvaluatorName, setNewEvaluatorName] = useState("");
  const [isEvaluatorNameTouched, setIsEvaluatorNameTouched] = useState(false);
  const [selection, setSelection] = useState<DecisionVersionSelection | null>(
    null
  );
  // The evaluator's policy as edited; null until the author touches it, so an
  // untouched policy is left to the server's defaults.
  const [evaluatorPolicyDraft, setEvaluatorPolicyDraft] =
    useState<DecisionScoringPolicyValue | null>(null);
  // Set once createDecisionEvaluator succeeds, so a retry after a failed
  // binding binds this evaluator instead of creating a duplicate.
  const [createdEvaluator, setCreatedEvaluator] =
    useState<DecisionEvaluatorData | null>(null);
  const [mappingKey, setMappingKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showValidationError, setShowValidationError] = useState(false);

  const evaluatorData: DecisionEvaluatorData | null =
    createdEvaluator ??
    (evaluatorSourceMode === "existing"
      ? (evaluators.find((evaluator) => evaluator.id === selectedEvaluatorId) ??
        null)
      : null);
  const view = useMemo(() => {
    if (evaluatorData) {
      return toDecisionEvaluatorView(evaluatorData);
    }
    if (evaluatorSourceMode === "new" && selection) {
      return {
        id: null,
        name: newEvaluatorName,
        variables: selection.inputs.map(({ name }) => name),
        questions: selection.questions,
        policy: normalizePolicy(selection.questions, evaluatorPolicyDraft),
      };
    }
    return null;
  }, [
    evaluatorData,
    evaluatorSourceMode,
    selection,
    newEvaluatorName,
    evaluatorPolicyDraft,
  ]);

  // Mappings belong to one evaluator's inputs, so changing the evaluator starts over.
  const resetBinding = useCallback(() => {
    const { setPathMapping, setLiteralMapping } = store.getState();
    setPathMapping({});
    setLiteralMapping({});
    setMappingKey((key) => key + 1);
  }, [store]);

  const isEvaluatorLocked = createdEvaluator != null;
  const evaluatorNameValidation = validateIdentifier(newEvaluatorName);
  const evaluatorNameError =
    isEvaluatorNameTouched && evaluatorNameValidation !== true
      ? String(evaluatorNameValidation)
      : undefined;

  // What stops a save before any request, if anything.
  const getCreateProblem = ():
    | { message?: string; touchEvaluatorName?: boolean }
    | undefined => {
    if (
      !createdEvaluator &&
      evaluatorSourceMode === "existing" &&
      !evaluatorData
    ) {
      return { message: "Select a decision evaluator to add to this dataset." };
    }
    if (!createdEvaluator && evaluatorSourceMode === "new" && !selection) {
      return { message: "Select a decision version for the new evaluator." };
    }
    if (
      !createdEvaluator &&
      evaluatorSourceMode === "new" &&
      evaluatorNameValidation !== true
    ) {
      return { touchEvaluatorName: true };
    }
    const isScoringValid =
      createdEvaluator || evaluatorSourceMode !== "new"
        ? true
        : isPolicyValid(
            evaluatorPolicyDraft ? validatePolicy(evaluatorPolicyDraft) : {}
          );
    return isScoringValid
      ? undefined
      : {
          message: "Fix the scoring settings highlighted below before saving.",
        };
  };

  const onSubmit = async () => {
    setError(undefined);
    const isValid = await store.getState().validateAll();
    if (!isValid) {
      if (
        !createdEvaluator &&
        evaluatorSourceMode === "new" &&
        evaluatorNameValidation !== true
      ) {
        setIsEvaluatorNameTouched(true);
      }
      setShowValidationError(true);
      return;
    }
    setShowValidationError(false);
    const problem = getCreateProblem();
    if (problem) {
      if (problem.touchEvaluatorName) {
        setIsEvaluatorNameTouched(true);
      }
      if (problem.message) {
        setError(problem.message);
      }
      return;
    }

    setIsSubmitting(true);
    const { evaluator } = store.getState();
    const result = await runCreateDecisionEvaluator({
      evaluator: evaluatorData,
      newEvaluator: selection
        ? {
            name: newEvaluatorName,
            versionId: selection.versionId,
            questions: selection.questions,
            policyDraft: evaluatorPolicyDraft,
          }
        : null,
      description: evaluator.description.trim() || null,
      bindingName: evaluator.globalName,
      inputMapping: normalizeInputMapping(evaluator.inputMapping),
      datasetId,
      connectionIds: updateConnectionIds ?? [],
      commitEvaluator: (input) =>
        commitAsync(createEvaluator, { input }).then(
          (response) => response.createDecisionEvaluator.evaluator
        ),
      commitBinding: (input, connectionIds) =>
        commitAsync(createBinding, { input, connectionIds }).then(
          (response) => response.createDatasetDecisionEvaluator.evaluator.id
        ),
    });
    // Keep a evaluator that was created selected, so a retry binds it rather
    // than creating it again.
    if (result.createdEvaluator) {
      setCreatedEvaluator(result.createdEvaluator);
    }
    setIsSubmitting(false);
    if (result.ok) {
      onEvaluatorCreated?.(result.datasetEvaluatorId);
      notifySuccess({ title: "Evaluator created" });
      onClose();
    } else {
      setError(result.message);
    }
  };

  const left = (
    <Flex direction="column" gap="size-300">
      <EvaluatorNameAndDescriptionFields
        isNameRequired
        descriptionPlaceholder="What this evaluator measures on this dataset"
      />
      <section aria-label="Decision evaluator">
        <Flex direction="column" gap="size-150">
          <EvaluatorSectionHeader
            title="Decision evaluator"
            description="The saved decision that evaluators each example. Use one that already exists, or create one from a decision version."
          />
          {isEvaluatorLocked ? (
            <Alert variant="info" title="Decision evaluator created">
              {`The evaluator "${createdEvaluator.name}" is saved. Finish adding it to this dataset; saving again will not create it twice.`}
            </Alert>
          ) : null}
          <RadioGroup
            aria-label="Decision evaluator source"
            value={evaluatorSourceMode}
            isDisabled={isEvaluatorLocked || isSubmitting}
            onChange={(value) => {
              setEvaluatorSourceMode(value as EvaluatorSourceMode);
              resetBinding();
            }}
            data-testid="decision-evaluator-evaluator-mode-radio-group"
          >
            <Radio value="existing" isDisabled={evaluators.length === 0}>
              Use an existing evaluator
            </Radio>
            <Radio value="new">Create a new evaluator</Radio>
          </RadioGroup>
          {evaluatorSourceMode === "existing" ? (
            <ExistingEvaluatorSelect
              evaluators={evaluators}
              selectedEvaluatorId={createdEvaluator?.id ?? selectedEvaluatorId}
              isDisabled={isEvaluatorLocked || isSubmitting}
              onChange={(evaluatorId) => {
                setSelectedEvaluatorId(evaluatorId);
                resetBinding();
              }}
            />
          ) : (
            <Flex direction="column" gap="size-150">
              <TextField
                value={newEvaluatorName}
                onChange={(value) => setNewEvaluatorName(value)}
                onBlur={() => setIsEvaluatorNameTouched(true)}
                isInvalid={evaluatorNameError != null}
                isDisabled={isEvaluatorLocked || isSubmitting}
                isRequired
                autoComplete="off"
                data-testid="decision-evaluator-evaluator-name-input"
              >
                <Label>Evaluator name</Label>
                <Input placeholder="e.g. answer_quality_evaluator" />
                <Text slot="description">
                  The name of the saved evaluator, shared by every dataset that
                  uses it. This dataset&apos;s evaluator name is set above.
                </Text>
                <FieldError>{evaluatorNameError}</FieldError>
              </TextField>
              <DecisionVersionPicker
                value={selection}
                isDisabled={isEvaluatorLocked || isSubmitting}
                onChange={(next) => {
                  setSelection(next);
                  setEvaluatorPolicyDraft(null);
                  resetBinding();
                }}
              />
              {selection && !isEvaluatorLocked ? (
                <DecisionScoringDisclosure
                  id="decision-evaluator-scoring"
                  title="Evaluator scoring (optional)"
                  description="How the evaluator's answers become scores, wherever the evaluator runs."
                  summary={evaluatorPolicySummary(
                    selection.questions,
                    evaluatorPolicyDraft
                  )}
                >
                  <DecisionScoringPolicyEditor
                    questions={selection.questions}
                    value={
                      evaluatorPolicyDraft ??
                      buildDefaultPolicy(selection.questions)
                    }
                    onChange={setEvaluatorPolicyDraft}
                    isDisabled={isSubmitting}
                  />
                </DecisionScoringDisclosure>
              ) : null}
            </Flex>
          )}
        </Flex>
      </section>
      {view ? (
        <section aria-label="Input mapping">
          <Flex direction="column" gap="size-150">
            <EvaluatorSectionHeader
              title="Input mapping"
              description="Map the evaluator's inputs to fields of the dataset example, the task output, and the reference output."
            />
            <EvaluatorInputMapping key={mappingKey} />
          </Flex>
        </section>
      ) : (
        <Text color="text-500">
          Choose a decision evaluator to map its inputs.
        </Text>
      )}
    </Flex>
  );

  const right = (
    <Flex direction="column" gap="size-200">
      <View paddingX="size-200">
        <Flex direction="column" gap="size-100">
          <Text color="text-500">
            Pick an example to see the fields available for input mapping. A
            decision evaluator can be tested from its edit page once it is
            saved.
          </Text>
          <EvaluatorExampleDataset />
        </Flex>
      </View>
      <EvaluatorInputPreview />
    </Flex>
  );

  return (
    <EvaluatorFormDialogContent
      title="Create Decision Evaluator"
      submitLabel="Create"
      onSubmit={() => void onSubmit()}
      isSubmitting={isSubmitting}
      error={error}
      errorTitle="Failed to create evaluator"
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
        <CodeEvaluatorInputVariablesProvider variables={view?.variables ?? []}>
          {form}
        </CodeEvaluatorInputVariablesProvider>
      )}
      submitButtonProps={{
        "data-testid": "decision-evaluator-form-submit-button",
        "data-mode": "create",
      }}
    />
  );
};

type CreateEvaluatorInput =
  CreateDecisionDatasetEvaluatorSlideover_createEvaluatorMutation["variables"]["input"];
type CreateBindingInput =
  CreateDecisionDatasetEvaluatorSlideover_createBindingMutation["variables"]["input"];

type RunCreateResult =
  | {
      ok: true;
      datasetEvaluatorId: string;
      createdEvaluator: DecisionEvaluatorData | null;
    }
  | {
      ok: false;
      message: string;
      createdEvaluator: DecisionEvaluatorData | null;
    };

/**
 * Creates the evaluator when there is not one yet, then binds it to the dataset.
 * Never throws: a failure after the evaluator exists reports that evaluator so the
 * caller can keep it selected for the retry.
 */
async function runCreateDecisionEvaluator({
  evaluator,
  newEvaluator,
  description,
  bindingName,
  inputMapping,
  datasetId,
  connectionIds,
  commitEvaluator,
  commitBinding,
}: {
  evaluator: DecisionEvaluatorData | null;
  newEvaluator: {
    name: string;
    versionId: string;
    questions: DecisionQuestionDefinition[];
    policyDraft: DecisionScoringPolicyValue | null;
  } | null;
  description: string | null;
  bindingName: string;
  inputMapping: CreateBindingInput["inputMapping"];
  datasetId: string;
  connectionIds: string[];
  commitEvaluator: (
    input: CreateEvaluatorInput
  ) => Promise<DecisionEvaluatorData>;
  commitBinding: (
    input: CreateBindingInput,
    connectionIds: string[]
  ) => Promise<string>;
}): Promise<RunCreateResult> {
  let boundEvaluator = evaluator;
  let createdEvaluator: DecisionEvaluatorData | null = null;
  if (boundEvaluator == null) {
    if (newEvaluator == null) {
      return {
        ok: false,
        message: "Select a decision evaluator to add to this dataset.",
        createdEvaluator,
      };
    }
    const created = await commitEvaluator({
      name: newEvaluator.name,
      decisionVersionId: newEvaluator.versionId,
      description,
      scoringPolicy: newEvaluator.policyDraft
        ? normalizePolicy(newEvaluator.questions, newEvaluator.policyDraft)
        : null,
    }).catch((e: unknown) => e);
    if (created instanceof Error) {
      return {
        ok: false,
        message: getMutationErrorMessage(created),
        createdEvaluator,
      };
    }
    boundEvaluator = created as DecisionEvaluatorData;
    createdEvaluator = boundEvaluator;
  }
  const bindingId = await commitBinding(
    {
      datasetId,
      evaluatorId: boundEvaluator.id,
      name: bindingName,
      description,
      inputMapping,
    },
    connectionIds
  ).catch((e: unknown) => e);
  if (typeof bindingId !== "string") {
    const message = getMutationErrorMessage(bindingId);
    return {
      ok: false,
      message: createdEvaluator
        ? `The decision evaluator "${createdEvaluator.name}" was created, but adding it to the dataset failed. Saving again adds it without creating it twice. ${message}`
        : message,
      createdEvaluator,
    };
  }
  return { ok: true, datasetEvaluatorId: bindingId, createdEvaluator };
}

type EvaluatorOption = { readonly id: string; readonly name: string };

const ExistingEvaluatorSelect = ({
  evaluators,
  selectedEvaluatorId,
  isDisabled,
  onChange,
}: {
  evaluators: readonly EvaluatorOption[];
  selectedEvaluatorId: string | null;
  isDisabled?: boolean;
  onChange: (evaluatorId: string) => void;
}) => (
  <Select
    aria-label="Decision evaluator"
    placeholder="Select a decision evaluator"
    isDisabled={isDisabled}
    value={selectedEvaluatorId}
    onChange={(key) => {
      if (key != null && key !== selectedEvaluatorId) {
        onChange(String(key));
      }
    }}
    data-testid="decision-evaluator-evaluator-select"
  >
    <Label>Evaluator</Label>
    <Button>
      <SelectValue />
      <SelectChevronUpDownIcon />
    </Button>
    <Popover>
      <ListBox>
        {evaluators.map((evaluator) => (
          <SelectItem
            key={evaluator.id}
            id={evaluator.id}
            textValue={evaluator.name}
          >
            {evaluator.name}
          </SelectItem>
        ))}
      </ListBox>
    </Popover>
  </Select>
);
