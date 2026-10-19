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
import type { CreateDecisionDatasetEvaluatorSlideover_createJudgeMutation } from "@phoenix/components/dataset/__generated__/CreateDecisionDatasetEvaluatorSlideover_createJudgeMutation.graphql";
import type { CreateDecisionDatasetEvaluatorSlideover_judgesQuery } from "@phoenix/components/dataset/__generated__/CreateDecisionDatasetEvaluatorSlideover_judgesQuery.graphql";
import type { DecisionJudgeData } from "@phoenix/components/dataset/decisionDatasetEvaluatorUtils";
import {
  commitAsync,
  getMutationErrorMessage,
  judgePolicySummary,
  overrideSummary,
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
  validatePolicy,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import { DecisionProjectionPolicyEditor } from "@phoenix/components/evaluators/decision/DecisionProjectionPolicyEditor";
import { DecisionScoringDisclosure } from "@phoenix/components/evaluators/decision/DecisionScoringDisclosure";
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

type JudgeMode = "existing" | "new";

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
    useLazyLoadQuery<CreateDecisionDatasetEvaluatorSlideover_judgesQuery>(
      graphql`
        query CreateDecisionDatasetEvaluatorSlideover_judgesQuery {
          evaluators(first: 200) {
            edges {
              judge: node {
                __typename
                id
                name
                ... on DecisionEvaluator {
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
  const [createJudge] =
    useMutation<CreateDecisionDatasetEvaluatorSlideover_createJudgeMutation>(
      graphql`
        mutation CreateDecisionDatasetEvaluatorSlideover_createJudgeMutation(
          $input: CreateDecisionEvaluatorInput!
        ) {
          createDecisionEvaluator(input: $input) {
            evaluator {
              id
              name
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

  const judges = useMemo(
    () =>
      data.evaluators.edges.flatMap(({ judge }): DecisionJudgeData[] =>
        judge.__typename === "DecisionEvaluator" &&
        judge.projectionPolicy &&
        judge.decisionVersion
          ? [
              {
                id: judge.id,
                name: judge.name,
                inputSchema: judge.inputSchema,
                projectionPolicy: judge.projectionPolicy,
                decisionVersion: judge.decisionVersion,
              },
            ]
          : []
      ),
    [data]
  );

  const [judgeMode, setJudgeMode] = useState<JudgeMode>(
    judges.length > 0 ? "existing" : "new"
  );
  const [selectedJudgeId, setSelectedJudgeId] = useState<string | null>(null);
  const [newJudgeName, setNewJudgeName] = useState("");
  const [isJudgeNameTouched, setIsJudgeNameTouched] = useState(false);
  const [selection, setSelection] = useState<DecisionVersionSelection | null>(
    null
  );
  // The judge's policy as edited; null until the author touches it, so an
  // untouched policy is left to the server's defaults.
  const [judgePolicyDraft, setJudgePolicyDraft] =
    useState<DecisionProjectionPolicyValue | null>(null);
  // Set once createDecisionEvaluator succeeds, so a retry after a failed
  // binding binds this judge instead of creating a duplicate.
  const [createdJudge, setCreatedJudge] = useState<DecisionJudgeData | null>(
    null
  );
  const [bindingOverride, setBindingOverride] =
    useState<DecisionProjectionPolicyValue | null>(null);
  const [mappingKey, setMappingKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showValidationError, setShowValidationError] = useState(false);

  const judgeData: DecisionJudgeData | null =
    createdJudge ??
    (judgeMode === "existing"
      ? (judges.find((judge) => judge.id === selectedJudgeId) ?? null)
      : null);
  const view = useMemo(() => {
    if (judgeData) {
      return toDecisionJudgeView(judgeData);
    }
    if (judgeMode === "new" && selection) {
      return {
        id: null,
        name: newJudgeName,
        variables: selection.inputs.map(({ name }) => name),
        questions: selection.questions,
        policy: normalizePolicy(selection.questions, judgePolicyDraft),
      };
    }
    return null;
  }, [judgeData, judgeMode, selection, newJudgeName, judgePolicyDraft]);

  // Mappings belong to one judge's inputs, so changing the judge starts over.
  const resetBinding = useCallback(() => {
    const { setPathMapping, setLiteralMapping } = store.getState();
    setPathMapping({});
    setLiteralMapping({});
    setBindingOverride(null);
    setMappingKey((key) => key + 1);
  }, [store]);

  const isJudgeLocked = createdJudge != null;
  const judgeNameValidation = validateIdentifier(newJudgeName);
  const judgeNameError =
    isJudgeNameTouched && judgeNameValidation !== true
      ? String(judgeNameValidation)
      : undefined;

  // What stops a save before any request, if anything.
  const getCreateProblem = ():
    | { message?: string; touchJudgeName?: boolean }
    | undefined => {
    if (!createdJudge && judgeMode === "existing" && !judgeData) {
      return { message: "Select a decision judge to add to this dataset." };
    }
    if (!createdJudge && judgeMode === "new" && !selection) {
      return { message: "Select a decision version for the new judge." };
    }
    if (!createdJudge && judgeMode === "new" && judgeNameValidation !== true) {
      return { touchJudgeName: true };
    }
    const isJudgeScoringValid =
      createdJudge || judgeMode !== "new"
        ? true
        : isPolicyValid(
            judgePolicyDraft ? validatePolicy(judgePolicyDraft) : {}
          );
    const isScoringValid =
      isJudgeScoringValid &&
      isPolicyValid(bindingOverride ? validatePolicy(bindingOverride) : {});
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
        !createdJudge &&
        judgeMode === "new" &&
        judgeNameValidation !== true
      ) {
        setIsJudgeNameTouched(true);
      }
      setShowValidationError(true);
      return;
    }
    setShowValidationError(false);
    const problem = getCreateProblem();
    if (problem) {
      if (problem.touchJudgeName) {
        setIsJudgeNameTouched(true);
      }
      if (problem.message) {
        setError(problem.message);
      }
      return;
    }

    setIsSubmitting(true);
    const { evaluator } = store.getState();
    const result = await runCreateDecisionEvaluator({
      judge: judgeData,
      newJudge: selection
        ? {
            name: newJudgeName,
            versionId: selection.versionId,
            questions: selection.questions,
            policyDraft: judgePolicyDraft,
          }
        : null,
      description: evaluator.description.trim() || null,
      bindingName: evaluator.globalName,
      inputMapping: normalizeInputMapping(evaluator.inputMapping),
      projectionPolicy: toBindingPolicyInput(
        pruneBindingOverride(bindingOverride, view?.questions ?? [])
      ),
      datasetId,
      connectionIds: updateConnectionIds ?? [],
      commitJudge: (input) =>
        commitAsync(createJudge, { input }).then(
          (response) => response.createDecisionEvaluator.evaluator
        ),
      commitBinding: (input, connectionIds) =>
        commitAsync(createBinding, { input, connectionIds }).then(
          (response) => response.createDatasetDecisionEvaluator.evaluator.id
        ),
    });
    // Keep a judge that was created selected, so a retry binds it rather
    // than creating it again.
    if (result.createdJudge) {
      setCreatedJudge(result.createdJudge);
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
      <section aria-label="Decision judge">
        <Flex direction="column" gap="size-150">
          <EvaluatorSectionHeader
            title="Decision judge"
            description="The saved decision that judges each example. Use one that already exists, or create one from a decision version."
          />
          {isJudgeLocked ? (
            <Alert variant="info" title="Decision judge created">
              {`The judge "${createdJudge.name}" is saved. Finish adding it to this dataset; saving again will not create it twice.`}
            </Alert>
          ) : null}
          <RadioGroup
            aria-label="Decision judge source"
            value={judgeMode}
            isDisabled={isJudgeLocked || isSubmitting}
            onChange={(value) => {
              setJudgeMode(value as JudgeMode);
              resetBinding();
            }}
            data-testid="decision-evaluator-judge-mode-radio-group"
          >
            <Radio value="existing" isDisabled={judges.length === 0}>
              Use an existing judge
            </Radio>
            <Radio value="new">Create a new judge</Radio>
          </RadioGroup>
          {judgeMode === "existing" ? (
            <ExistingJudgeSelect
              judges={judges}
              selectedJudgeId={createdJudge?.id ?? selectedJudgeId}
              isDisabled={isJudgeLocked || isSubmitting}
              onChange={(judgeId) => {
                setSelectedJudgeId(judgeId);
                resetBinding();
              }}
            />
          ) : (
            <Flex direction="column" gap="size-150">
              <TextField
                value={newJudgeName}
                onChange={(value) => setNewJudgeName(value)}
                onBlur={() => setIsJudgeNameTouched(true)}
                isInvalid={judgeNameError != null}
                isDisabled={isJudgeLocked || isSubmitting}
                isRequired
                autoComplete="off"
                data-testid="decision-evaluator-judge-name-input"
              >
                <Label>Judge name</Label>
                <Input placeholder="e.g. answer_quality_judge" />
                <Text slot="description">
                  The name of the saved judge, shared by every dataset that uses
                  it. This dataset&apos;s evaluator name is set above.
                </Text>
                <FieldError>{judgeNameError}</FieldError>
              </TextField>
              <DecisionVersionPicker
                value={selection}
                isDisabled={isJudgeLocked || isSubmitting}
                onChange={(next) => {
                  setSelection(next);
                  setJudgePolicyDraft(null);
                  resetBinding();
                }}
              />
              {selection && !isJudgeLocked ? (
                <DecisionScoringDisclosure
                  id="decision-judge-scoring"
                  title="Judge scoring (optional)"
                  description="How the judge's answers become scores. Datasets can override this for themselves."
                  summary={judgePolicySummary(
                    selection.questions,
                    judgePolicyDraft
                  )}
                >
                  <DecisionProjectionPolicyEditor
                    questions={selection.questions}
                    value={
                      judgePolicyDraft ??
                      buildDefaultPolicy(selection.questions)
                    }
                    onChange={setJudgePolicyDraft}
                    isDisabled={isSubmitting}
                  />
                </DecisionScoringDisclosure>
              ) : null}
            </Flex>
          )}
        </Flex>
      </section>
      {view ? (
        <>
          <section aria-label="Input mapping">
            <Flex direction="column" gap="size-150">
              <EvaluatorSectionHeader
                title="Input mapping"
                description="Map the judge's inputs to fields of the dataset example, the task output, and the reference output."
              />
              <EvaluatorInputMapping key={mappingKey} />
            </Flex>
          </section>
          <section aria-label="Scoring for this dataset">
            <DecisionScoringDisclosure
              id="decision-binding-scoring"
              title="Scoring for this dataset"
              description="Optional. Override how this dataset scores a question; every other question keeps the judge's settings."
              summary={overrideSummary(bindingOverride)}
            >
              <DecisionProjectionPolicyEditor
                questions={view.questions}
                value={bindingOverride}
                inheritedPolicy={view.policy}
                onChange={(next) =>
                  setBindingOverride(toBindingPolicyInput(next))
                }
                isDisabled={isSubmitting}
              />
            </DecisionScoringDisclosure>
          </section>
        </>
      ) : (
        <Text color="text-500">
          Choose a decision judge to map its inputs and set scoring.
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
            decision judge can be tested from its edit page once it is saved.
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

type CreateJudgeInput =
  CreateDecisionDatasetEvaluatorSlideover_createJudgeMutation["variables"]["input"];
type CreateBindingInput =
  CreateDecisionDatasetEvaluatorSlideover_createBindingMutation["variables"]["input"];

type RunCreateResult =
  | {
      ok: true;
      datasetEvaluatorId: string;
      createdJudge: DecisionJudgeData | null;
    }
  | {
      ok: false;
      message: string;
      createdJudge: DecisionJudgeData | null;
    };

/**
 * Creates the judge when there is not one yet, then binds it to the dataset.
 * Never throws: a failure after the judge exists reports that judge so the
 * caller can keep it selected for the retry.
 */
async function runCreateDecisionEvaluator({
  judge,
  newJudge,
  description,
  bindingName,
  inputMapping,
  projectionPolicy,
  datasetId,
  connectionIds,
  commitJudge,
  commitBinding,
}: {
  judge: DecisionJudgeData | null;
  newJudge: {
    name: string;
    versionId: string;
    questions: DecisionQuestionDefinition[];
    policyDraft: DecisionProjectionPolicyValue | null;
  } | null;
  description: string | null;
  bindingName: string;
  inputMapping: CreateBindingInput["inputMapping"];
  projectionPolicy: DecisionProjectionPolicyValue | null;
  datasetId: string;
  connectionIds: string[];
  commitJudge: (input: CreateJudgeInput) => Promise<DecisionJudgeData>;
  commitBinding: (
    input: CreateBindingInput,
    connectionIds: string[]
  ) => Promise<string>;
}): Promise<RunCreateResult> {
  let boundJudge = judge;
  let createdJudge: DecisionJudgeData | null = null;
  if (boundJudge == null) {
    if (newJudge == null) {
      return {
        ok: false,
        message: "Select a decision judge to add to this dataset.",
        createdJudge,
      };
    }
    const created = await commitJudge({
      name: newJudge.name,
      decisionVersionId: newJudge.versionId,
      description,
      projectionPolicy: newJudge.policyDraft
        ? normalizePolicy(newJudge.questions, newJudge.policyDraft)
        : null,
    }).catch((e: unknown) => e);
    if (created instanceof Error) {
      return {
        ok: false,
        message: getMutationErrorMessage(created),
        createdJudge,
      };
    }
    boundJudge = created as DecisionJudgeData;
    createdJudge = boundJudge;
  }
  const bindingId = await commitBinding(
    {
      datasetId,
      evaluatorId: boundJudge.id,
      name: bindingName,
      description,
      inputMapping,
      projectionPolicy,
    },
    connectionIds
  ).catch((e: unknown) => e);
  if (typeof bindingId !== "string") {
    const message = getMutationErrorMessage(bindingId);
    return {
      ok: false,
      message: createdJudge
        ? `The decision judge "${createdJudge.name}" was created, but adding it to the dataset failed. Saving again adds it without creating it twice. ${message}`
        : message,
      createdJudge,
    };
  }
  return { ok: true, datasetEvaluatorId: bindingId, createdJudge };
}

type JudgeOption = { readonly id: string; readonly name: string };

const ExistingJudgeSelect = ({
  judges,
  selectedJudgeId,
  isDisabled,
  onChange,
}: {
  judges: readonly JudgeOption[];
  selectedJudgeId: string | null;
  isDisabled?: boolean;
  onChange: (judgeId: string) => void;
}) => (
  <Select
    aria-label="Decision judge"
    placeholder="Select a decision judge"
    isDisabled={isDisabled}
    value={selectedJudgeId}
    onChange={(key) => {
      if (key != null && key !== selectedJudgeId) {
        onChange(String(key));
      }
    }}
    data-testid="decision-evaluator-judge-select"
  >
    <Label>Judge</Label>
    <Button>
      <SelectValue />
      <SelectChevronUpDownIcon />
    </Button>
    <Popover>
      <ListBox>
        {judges.map((judge) => (
          <SelectItem key={judge.id} id={judge.id} textValue={judge.name}>
            {judge.name}
          </SelectItem>
        ))}
      </ListBox>
    </Popover>
  </Select>
);
