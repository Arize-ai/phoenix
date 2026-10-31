import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import { Alert, Button, Flex, View } from "@phoenix/components";
import { DecisionEvaluatorDefinitionFields } from "@phoenix/components/evaluators/decision/DecisionEvaluatorDefinitionFields";
import { DecisionEvaluatorDraftProvider } from "@phoenix/components/evaluators/decision/DecisionEvaluatorDraftProvider";
import {
  commitAsync,
  getMutationErrorMessage,
  type DecisionEvaluatorData,
} from "@phoenix/components/evaluators/decision/decisionEvaluatorUtils";
import { useDecisionEvaluatorDraft } from "@phoenix/components/evaluators/decision/useDecisionEvaluatorDraft";
import { useDecisionEvaluatorSave } from "@phoenix/components/evaluators/decision/useDecisionEvaluatorSave";
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
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import {
  createDecisionQuestion,
  createDecisionStateDraft,
} from "@phoenix/pages/playground/decisionUtils";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import type { DecisionPromptDraft } from "@phoenix/store/playground";

import type { DecisionDatasetEvaluatorForm_createMutation } from "./__generated__/DecisionDatasetEvaluatorForm_createMutation.graphql";
import type { DecisionDatasetEvaluatorForm_previewMutation } from "./__generated__/DecisionDatasetEvaluatorForm_previewMutation.graphql";
import type { DecisionDatasetEvaluatorForm_updateMutation } from "./__generated__/DecisionDatasetEvaluatorForm_updateMutation.graphql";

type Props = {
  datasetId: string;
  datasetEvaluatorId?: string;
  initialEvaluator?: DecisionEvaluatorData;
  otherBindingCount?: number;
  updateConnectionIds?: string[];
  onClose: () => void;
  onSaved?: (id: string) => void;
};

function createDatasetDecisionDraft(): DecisionPromptDraft {
  return {
    state: createDecisionStateDraft({ text: "{{output}}" }),
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
  const [defaultDraft] = useState(createDatasetDecisionDraft);
  return (
    <DecisionEvaluatorDraftProvider defaultDraft={defaultDraft}>
      <DecisionDatasetEvaluatorFormContent {...props} />
    </DecisionEvaluatorDraftProvider>
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
  const notifySuccess = useNotifySuccess();
  const credentials = useCredentialsContext((state) => state);
  const bindingName = useEvaluatorStore((state) =>
    datasetEvaluatorId ? state.evaluator.name : state.evaluator.globalName
  );
  const draft = useDecisionEvaluatorDraft({ initialEvaluator });
  const { variables, isLoading, isVersionReady } = draft;
  const { getInputMapping, buildCreateInput, buildUpdateInput } =
    useDecisionEvaluatorSave(draft);
  const [submitError, setSubmitError] = useState<string | undefined>();
  const error = submitError ?? draft.loadError;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewResults, setPreviewResults] = useState<
    DecisionDatasetEvaluatorForm_previewMutation["response"]["evaluatorPreviews"]["results"]
  >([]);
  const isEditing = !!initialEvaluator;

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
            # The dataset's Evaluators tab counts its evaluators.
            dataset {
              id
              evaluatorCount
            }
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

  const getPreviewDefinition = () => ({
    inlineDecisionEvaluator: draft.getDefinition(
      bindingName || "decision_preview",
      "test"
    ),
  });
  const onTest = () => {
    setPreviewError(null);
    setPreviewResults([]);
    try {
      const evaluator = getPreviewDefinition();
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
    setSubmitError(undefined);
    try {
      let id: string;
      if (datasetEvaluatorId) {
        const input = await buildUpdateInput(bindingName);
        setIsSubmitting(true);
        const result = await commitAsync(update, {
          input: { ...input, datasetEvaluatorId },
        });
        id = result.updateDatasetDecisionEvaluator.evaluator.id;
      } else {
        const input = await buildCreateInput(bindingName);
        setIsSubmitting(true);
        const result = await commitAsync(create, {
          input: { ...input, datasetId },
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
      setSubmitError(getMutationErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const left = (
    <Flex direction="column" gap="size-200">
      <EvaluatorNameAndDescriptionFields isNameRequired />
      <DecisionEvaluatorDefinitionFields
        draft={draft}
        isDisabled={isSubmitting}
        scoringDescription="Turn each answer into the score this dataset records."
        sharedEvaluatorNote={`${otherBindingCount > 0 ? `${otherBindingCount} other dataset evaluators use it. ` : ""}Input mappings apply only to this dataset.`}
      />
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
