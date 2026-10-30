import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import { Flex } from "@phoenix/components";
import { DecisionEvaluatorDraftProvider } from "@phoenix/components/evaluators/decision/DecisionEvaluatorDraftProvider";
import { DecisionEvaluatorForm } from "@phoenix/components/evaluators/decision/DecisionEvaluatorForm";
import {
  commitAsync,
  type DecisionEvaluatorData,
} from "@phoenix/components/evaluators/decision/decisionEvaluatorUtils";
import { useDecisionEvaluatorDraft } from "@phoenix/components/evaluators/decision/useDecisionEvaluatorDraft";
import { useDecisionEvaluatorSave } from "@phoenix/components/evaluators/decision/useDecisionEvaluatorSave";
import { EvaluatorDatasetTestPanel } from "@phoenix/components/evaluators/EvaluatorDatasetTestPanel";
import { EvaluatorFormDialogContent } from "@phoenix/components/evaluators/EvaluatorFormDialogContent";
import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import {
  EvaluatorPreviewSection,
  getEvaluatorPreviewHelpText,
} from "@phoenix/components/evaluators/EvaluatorOutputPreview";
import { useEvaluatorPreview } from "@phoenix/components/evaluators/useEvaluatorPreview";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { useNotifySuccess } from "@phoenix/contexts/NotificationContext";
import { getMutationErrorMessage } from "@phoenix/utils/errorUtils";

import type { DecisionDatasetEvaluatorForm_createMutation } from "./__generated__/DecisionDatasetEvaluatorForm_createMutation.graphql";
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

export function DecisionDatasetEvaluatorForm(props: Props) {
  return (
    <DecisionEvaluatorDraftProvider surface="dataset">
      <DecisionDatasetEvaluatorFormContent {...props} />
    </DecisionEvaluatorDraftProvider>
  );
}

function DecisionDatasetEvaluatorFormContent({
  datasetId,
  datasetEvaluatorId,
  initialEvaluator,
  otherBindingCount = 0,
  updateConnectionIds = [],
  onClose,
  onSaved,
}: Props) {
  const notifySuccess = useNotifySuccess();
  const bindingName = useEvaluatorStore((state) =>
    datasetEvaluatorId ? state.evaluator.name : state.evaluator.globalName
  );
  const draft = useDecisionEvaluatorDraft({ initialEvaluator });
  const isDraftReady = !draft.isLoading && draft.isVersionReady;
  const { getInputMapping, buildCreateInput, buildUpdateInput } =
    useDecisionEvaluatorSave(draft);
  const preview = useEvaluatorPreview();
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const onTest = () =>
    void preview.run(() => ({
      evaluator: {
        inlineDecisionEvaluator: {
          name: bindingName || "decision_preview",
          ...draft.getTestDefinition(),
        },
      },
      inputMapping: getInputMapping(),
    }));
  const onSubmit = async () => {
    if (!isDraftReady) return;
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

  return (
    <EvaluatorFormDialogContent
      title={
        isEditing ? "Edit Decision Evaluator" : "Create Decision Evaluator"
      }
      submitLabel={isEditing ? "Update" : "Create"}
      onSubmit={() => void onSubmit()}
      isSubmitting={isSubmitting}
      isSubmitDisabled={!isDraftReady}
      error={submitError ?? draft.loadError}
      errorTitle="Failed to save evaluator"
      left={
        <Flex direction="column" gap="size-200">
          <EvaluatorNameAndDescriptionFields isNameRequired />
          <DecisionEvaluatorForm
            draft={draft}
            isDisabled={isSubmitting}
            scoringDescription="Turn each answer into the score this dataset records."
            sharedEvaluatorNote={`${otherBindingCount > 0 ? `${otherBindingCount} other dataset evaluators use it. ` : ""}Input mappings apply only to this dataset.`}
          />
        </Flex>
      }
      right={
        <EvaluatorDatasetTestPanel
          testSection={
            <EvaluatorPreviewSection
              preview={preview}
              onTest={onTest}
              helpText={getEvaluatorPreviewHelpText("DECISION")}
              isDisabled={!isDraftReady || isSubmitting}
            />
          }
        />
      }
      renderInputVariables={(form) => (
        <EvaluatorInputVariablesProvider variables={draft.variables}>
          {form}
        </EvaluatorInputVariablesProvider>
      )}
      submitButtonProps={{
        "data-testid": "decision-evaluator-form-submit-button",
        "data-mode": isEditing ? "update" : "create",
      }}
    />
  );
}
