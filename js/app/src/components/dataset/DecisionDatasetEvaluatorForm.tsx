import { Suspense, useEffect, useState } from "react";
import { graphql, useMutation } from "react-relay";

import { Alert, Button, Flex, Loading, Text, View } from "@phoenix/components";
import {
  normalizePolicy,
  policyOutputToInput,
  isPolicyValid,
  validatePolicy,
  type DecisionQuestionDefinition,
  type DecisionScoringPolicyValue,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import { DecisionScoringPolicyEditor } from "@phoenix/components/evaluators/decision/DecisionScoringPolicyEditor";
import {
  DecisionVersionPicker,
  type DecisionVersionSelection,
} from "@phoenix/components/evaluators/decision/DecisionVersionPicker";
import { EvaluatorExampleDataset } from "@phoenix/components/evaluators/EvaluatorExampleDataset";
import { EvaluatorFormDialogContent } from "@phoenix/components/evaluators/EvaluatorFormDialogContent";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorInputPreview } from "@phoenix/components/evaluators/EvaluatorInputPreview";
import { CodeEvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/CodeEvaluatorInputVariablesProvider";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import {
  AnnotationPreviewCard,
  AnnotationPreviewSkeletonCard,
} from "@phoenix/components/evaluators/EvaluatorOutputPreview";
import { normalizeInputMapping } from "@phoenix/components/evaluators/utils";
import { ModelMenu } from "@phoenix/components/generative";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import {
  PlaygroundProvider,
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { DecisionRequestEditor } from "@phoenix/pages/playground/DecisionRequestEditor";
import {
  createDecisionQuestion,
  extractDecisionVariables,
} from "@phoenix/pages/playground/decisionUtils";
import { DecisionVersionSelector } from "@phoenix/pages/playground/DecisionVersionSelector";
import { fetchPlaygroundDecisionAsInstance } from "@phoenix/pages/playground/fetchPlaygroundDecision";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import { toDecisionVersionInput } from "@phoenix/pages/playground/savedDecisionUtils";
import { TemplateFormatRadioGroup } from "@phoenix/pages/playground/TemplateFormatRadioGroup";
import {
  createDecisionTaskInstance,
  type DecisionRequestDraft,
} from "@phoenix/store/playground";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

import type { DecisionDatasetEvaluatorForm_createMutation } from "./__generated__/DecisionDatasetEvaluatorForm_createMutation.graphql";
import type { DecisionDatasetEvaluatorForm_previewMutation } from "./__generated__/DecisionDatasetEvaluatorForm_previewMutation.graphql";
import type { DecisionDatasetEvaluatorForm_updateMutation } from "./__generated__/DecisionDatasetEvaluatorForm_updateMutation.graphql";
import {
  commitAsync,
  getMutationErrorMessage,
  type DecisionEvaluatorData,
} from "./decisionDatasetEvaluatorUtils";

type Props = {
  datasetId: string;
  datasetEvaluatorId?: string;
  initialEvaluator?: DecisionEvaluatorData;
  otherBindingCount?: number;
  updateConnectionIds?: string[];
  onClose: () => void;
  onSaved?: (id: string) => void;
};

function createDatasetDecisionDraft(): DecisionRequestDraft {
  return {
    state: "{{output}}",
    stateEditorMode: "text",
    questions: [
      createDecisionQuestion({
        type: "predicate",
        name: "relevant",
        instructions: "Is the output relevant to the request?",
      }),
    ],
  };
}

export function DecisionDatasetEvaluatorForm(props: Props) {
  const [instances] = useState(() => [
    {
      ...createDecisionTaskInstance(),
      id: 1,
      decisionRequest: createDatasetDecisionDraft(),
    },
  ]);
  return (
    <PlaygroundProvider
      modelConfigByProvider={{}}
      instances={instances}
      templateFormat={TemplateFormats.Mustache}
    >
      <DecisionDatasetEvaluatorFormContent {...props} />
    </PlaygroundProvider>
  );
}

// oxlint-disable-next-line complexity -- create and edit.
function DecisionDatasetEvaluatorFormContent({
  datasetId,
  datasetEvaluatorId,
  initialEvaluator,
  otherBindingCount = 0,
  updateConnectionIds = [],
  onClose,
  onSaved,
}: Props) {
  const store = useEvaluatorStoreInstance();
  const playground = usePlaygroundStore();
  const instance = usePlaygroundContext((state) => state.instances[0]);
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const notifySuccess = useNotifySuccess();
  const credentials = useCredentialsContext((state) => state);
  const bindingName = useEvaluatorStore((state) =>
    datasetEvaluatorId ? state.evaluator.name : state.evaluator.globalName
  );
  const [selection, setSelection] = useState<DecisionVersionSelection | null>(
    null
  );
  const [policyDraft, setPolicyDraft] =
    useState<DecisionScoringPolicyValue | null>(
      initialEvaluator
        ? policyOutputToInput(initialEvaluator.scoringPolicy)
        : null
    );
  const [selectedTagName, setSelectedTagName] = useState<string | null>(null);
  const [loadedVersionId, setLoadedVersionId] = useState(
    initialEvaluator?.decisionVersion.id
  );
  const [loadedVersion, setLoadedVersion] = useState<string | null>(null);
  const [isVersionReady, setIsVersionReady] = useState(!initialEvaluator);
  const [isLoading, setIsLoading] = useState(!!initialEvaluator);
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewResults, setPreviewResults] = useState<
    DecisionDatasetEvaluatorForm_previewMutation["response"]["evaluatorPreviews"]["results"]
  >([]);
  const isEditing = !!initialEvaluator;
  const selectedDecisionId =
    selection?.decisionId ?? initialEvaluator?.decisionVersion.decision.id;
  const selectedVersionId = selectedTagName
    ? undefined
    : selection?.versionId ?? initialEvaluator?.decisionVersion.id;

  useEffect(() => {
    if (!selectedDecisionId || (!selectedVersionId && !selectedTagName)) {
      return () => undefined;
    }
    let isCurrent = true;
    // eslint-disable-next-line react/set-state-in-effect -- fetch starts after this render
    setIsLoading(true);
    setIsVersionReady(false);
    setError(undefined);
    void fetchPlaygroundDecisionAsInstance({
      decisionId: selectedDecisionId,
      decisionVersionId: selectedVersionId,
      tagName: selectedTagName,
      templateFormat: null,
    })
      .then((loaded) => {
        if (!isCurrent) return;
        if (!loaded)
          throw new Error("The Decision version could not be loaded.");
        const state = playground.getState();
        state.setTemplateFormat(loaded.templateFormat);
        state.loadInstance({ instanceId: 1, instance: loaded.instance });
        setLoadedVersionId(loaded.instance.decision?.versionId);
        setLoadedVersion(
          JSON.stringify(
            toDecisionVersionInput({
              instance: loaded.instance,
              templateFormat: loaded.templateFormat,
            })
          )
        );
        setIsLoading(false);
        setIsVersionReady(true);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setError(getMutationErrorMessage(error));
        setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [playground, selectedDecisionId, selectedVersionId, selectedTagName]);

  const draftQuestions: DecisionQuestionDefinition[] = (
    instance.decisionRequest?.questions ?? []
  ).map((question) =>
    question.type === "choice"
      ? {
          type: "choice",
          name: question.name,
          choices: question.choices.map(({ value }) => value),
        }
      : question.type === "scale"
      ? {
          type: "scale",
          name: question.name,
          levels: question.levels.map(({ label }) => label),
        }
      : { type: "predicate", name: question.name }
  );
  const questions = draftQuestions;
  const variables = extractDecisionVariables({
    draft: instance.decisionRequest!,
    templateFormat,
  });
  const policy = normalizePolicy(questions, policyDraft);
  const readVersion = (purpose: "save" | "test") =>
    toDecisionVersionInput({ instance, templateFormat, purpose });
  let version: ReturnType<typeof toDecisionVersionInput> | null = null;
  let draftError: string | null = null;
  try {
    version = readVersion("save");
  } catch (error) {
    draftError = getMutationErrorMessage(error);
  }
  const hasDecisionChanges =
    loadedVersion == null || JSON.stringify(version) !== loadedVersion;

  const [create] =
    useMutation<DecisionDatasetEvaluatorForm_createMutation>(graphql`
      mutation DecisionDatasetEvaluatorForm_createMutation(
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
            ...DatasetEvaluatorsTable_row
          }
        }
      }
    `);
  const [update] =
    useMutation<DecisionDatasetEvaluatorForm_updateMutation>(graphql`
      mutation DecisionDatasetEvaluatorForm_updateMutation(
        $input: UpdateDatasetDecisionEvaluatorInput!
      ) {
        updateDatasetDecisionEvaluator(input: $input) {
          evaluator {
            id
            name
            description
            inputMapping {
              literalMapping
              pathMapping
            }
            ...DatasetEvaluatorsTable_row
          }
        }
      }
    `);
  const [preview, isPreviewing] =
    useMutation<DecisionDatasetEvaluatorForm_previewMutation>(graphql`
      mutation DecisionDatasetEvaluatorForm_previewMutation(
        $input: EvaluatorPreviewsInput!
      ) {
        evaluatorPreviews(input: $input) {
          results {
            evaluatorName
            error
            annotation {
              ...decisionAnnotation_annotation @relay(mask: false)
              id
              name
              label
              score
              explanation
            }
          }
        }
      }
    `);

  const getDefinition = (purpose: "save" | "test" = "save") => {
    if (isLoading || !isVersionReady)
      throw new Error("Load a Decision version before continuing.");
    const current = purpose === "test" ? readVersion("test") : version;
    if (!current)
      throw new Error(draftError ?? "Complete the Decision definition.");
    if (!isPolicyValid(validatePolicy(policy)))
      throw new Error("Fix the scoring settings before continuing.");
    return {
      inlineDecisionEvaluator: {
        name: bindingName || "decision_preview",
        decisionVersion: current,
        scoringPolicy: policy,
      },
    };
  };
  const getInputMapping = () => {
    const mapping = normalizeInputMapping(
      store.getState().evaluator.inputMapping
    );
    const declared = new Set(variables);
    return {
      pathMapping: Object.fromEntries(
        Object.entries(mapping.pathMapping).filter(([name]) =>
          declared.has(name)
        )
      ),
      literalMapping: Object.fromEntries(
        Object.entries(mapping.literalMapping).filter(([name]) =>
          declared.has(name)
        )
      ),
    };
  };
  const onTest = () => {
    setPreviewError(null);
    setPreviewResults([]);
    try {
      const evaluator = getDefinition("test");
      const state = store.getState();
      preview({
        variables: {
          input: {
            previews: [
              {
                evaluator,
                context: state.evaluatorMappingSource.source,
                inputMapping: getInputMapping(),
              },
            ],
            credentials: toGqlCredentials(credentials),
          },
        },
        onCompleted: (response, errors) => {
          if (errors?.length)
            setPreviewError(errors.map(({ message }) => message).join("\n"));
          else setPreviewResults(response.evaluatorPreviews.results);
        },
        onError: (error) => setPreviewError(getMutationErrorMessage(error)),
      });
    } catch (error) {
      setPreviewError(getMutationErrorMessage(error));
    }
  };
  const onSubmit = async () => {
    if (isLoading || !isVersionReady) return;
    setError(undefined);
    if (!(await store.getState().validateAll())) {
      setError("Fix the highlighted fields before saving.");
      return;
    }
    try {
      getDefinition();
      const state = store.getState();
      const binding = {
        name: bindingName,
        description: state.evaluator.description.trim() || null,
        inputMapping: getInputMapping(),
      };
      setIsSubmitting(true);
      let id: string;
      if (datasetEvaluatorId) {
        const result = await commitAsync(update, {
          input: {
            ...binding,
            datasetEvaluatorId,
            ...(hasDecisionChanges
              ? { decisionVersion: version }
              : loadedVersionId !== initialEvaluator?.decisionVersion.id
              ? { decisionVersionId: loadedVersionId }
              : {}),
            scoringPolicy: policy,
          },
        });
        id = result.updateDatasetDecisionEvaluator.evaluator.id;
      } else {
        if (validateIdentifier(bindingName) !== true)
          throw new Error("Enter a valid evaluator name.");
        const result = await commitAsync(create, {
          input: {
            ...binding,
            datasetId,
            evaluatorName: bindingName,
            ...(hasDecisionChanges
              ? {
                  decisionVersion: version,
                  decisionId: selectedDecisionId,
                }
              : { decisionVersionId: loadedVersionId }),
            scoringPolicy: policy,
          },
          connectionIds: updateConnectionIds,
        });
        id = result.createDatasetDecisionEvaluator.evaluator.id;
      }
      notifySuccess({
        title: isEditing ? "Evaluator updated" : "Evaluator created",
      });
      onSaved?.(id);
      onClose();
    } catch (error) {
      setError(getMutationErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const left = (
    <Flex direction="column" gap="size-200">
      <EvaluatorNameAndDescriptionFields isNameRequired />
      {isEditing ? (
        <Alert variant="warning" title="Shared evaluator">
          Decision and scoring changes affect every dataset and online evaluator
          using this evaluator.
          {otherBindingCount > 0
            ? ` ${otherBindingCount} other dataset evaluators use it.`
            : ""}{" "}
          Input mappings apply only to this dataset. Saving definition changes
          creates a new Decision version.
        </Alert>
      ) : null}
      {initialEvaluator ? (
        <DecisionVersionSelector
          sequenceNumber={
            selection?.sequenceNumber ??
            initialEvaluator.decisionVersion.sequenceNumber
          }
          decision={{
            id: initialEvaluator.decisionVersion.decision.id,
            name: initialEvaluator.decisionVersion.decision.name,
            versionId: loadedVersionId ?? initialEvaluator.decisionVersion.id,
            tag: selectedTagName,
          }}
          onSelectVersion={(versionId) => {
            setSelectedTagName(null);
            setSelection({
              decisionId: initialEvaluator.decisionVersion.decision.id,
              decisionName: initialEvaluator.decisionVersion.decision.name,
              versionId,
              sequenceNumber: 0,
              tagName: null,
              inputs: [],
              questions: [],
            });
          }}
          onSelectTag={setSelectedTagName}
        />
      ) : (
        <DecisionVersionPicker
          value={selection}
          isDisabled={isSubmitting}
          onChange={(next) => {
            setSelection(next);
            setPolicyDraft(null);
          }}
        />
      )}
      <Text color="text-500" size="S">
        {initialEvaluator
          ? `Editing ${initialEvaluator.decisionVersion.decision.name}. Select another version of this Decision to start from.`
          : "Author a Decision below, or select a saved version to start from."}
      </Text>
      {isLoading ? (
        <Loading />
      ) : (
        <>
          <EvaluatorSectionHeader
            title="Decision"
            description="Write the state and questions this evaluator sends."
            extra={
              <Flex direction="row" gap="size-100" alignItems="center">
                <Suspense fallback={<Loading />}>
                  <ModelMenu
                    supportsDecisionModels
                    fixedModelType="DECISION"
                    credentialSource="server"
                    value={
                      instance.model.modelName
                        ? {
                            provider: instance.model.provider,
                            modelName: instance.model.modelName,
                            modelType: "DECISION",
                            customProvider:
                              instance.model.customProvider ?? undefined,
                          }
                        : null
                    }
                    onChange={(model) =>
                      playground.getState().updateInstance({
                        instanceId: 1,
                        patch: {
                          model: {
                            ...instance.model,
                            provider: model.provider,
                            modelName: model.modelName,
                            modelType: "DECISION",
                            customProvider: model.customProvider ?? null,
                          },
                        },
                        dirty: true,
                      })
                    }
                  />
                </Suspense>
                <TemplateFormatRadioGroup size="S" showNoneOption={false} />
              </Flex>
            }
          />
          <DecisionRequestEditor playgroundInstanceId={1} />
          <EvaluatorSectionHeader
            title="Scoring"
            description="Turn each answer into the score this dataset records."
          />
          <DecisionScoringPolicyEditor
            questions={questions}
            value={policy}
            onChange={setPolicyDraft}
            isDisabled={isSubmitting}
          />
        </>
      )}
      <EvaluatorSectionHeader
        title="Input mapping"
        description="Inputs named input, output, reference, or metadata fill from the example when left blank."
      />
      <EvaluatorInputMapping />
    </Flex>
  );
  const right = (
    <Flex direction="column" gap="size-200">
      <View paddingX="size-200">
        <Flex direction="column" gap="size-150">
          <EvaluatorExampleDataset />
          <EvaluatorSectionHeader
            title="Test with an Example"
            description="Run the current definition, scoring, and input mapping on the selected example. Unsaved changes are included."
            extra={
              <Button
                variant="primary"
                size="S"
                onPress={onTest}
                isPending={isPreviewing}
                isDisabled={isLoading || !isVersionReady || isSubmitting}
                data-testid="decision-evaluator-preview-button"
              >
                Test
              </Button>
            }
          />
          {isPreviewing ? <AnnotationPreviewSkeletonCard /> : null}
          {previewResults.map((result, index) =>
            result.error ? (
              <Alert key={index} variant="danger">
                {result.error}
              </Alert>
            ) : result.annotation ? (
              <AnnotationPreviewCard
                key={index}
                annotation={result.annotation}
              />
            ) : null
          )}
          {previewError ? <Alert variant="danger">{previewError}</Alert> : null}
        </Flex>
      </View>
      <EvaluatorInputPreview />
    </Flex>
  );
  return (
    <EvaluatorFormDialogContent
      title={
        isEditing ? "Edit Decision Evaluator" : "Create Decision Evaluator"
      }
      submitLabel={isEditing ? "Update" : "Create"}
      onSubmit={() => void onSubmit()}
      isSubmitting={isSubmitting}
      isSubmitDisabled={isLoading || !isVersionReady}
      error={error}
      errorTitle="Failed to save evaluator"
      left={left}
      right={right}
      renderInputVariables={(form) => (
        <CodeEvaluatorInputVariablesProvider variables={variables}>
          {form}
        </CodeEvaluatorInputVariablesProvider>
      )}
      submitButtonProps={{
        "data-testid": "decision-evaluator-form-submit-button",
        "data-mode": isEditing ? "update" : "create",
      }}
    />
  );
}
