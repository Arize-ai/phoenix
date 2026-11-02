import { Suspense } from "react";

import { Alert, Flex, Loading, Text } from "@phoenix/components";
import { DECISION_EVALUATOR_DRAFT_INSTANCE_ID } from "@phoenix/components/evaluators/decision/DecisionEvaluatorDraftProvider";
import { DecisionScoringPolicyEditor } from "@phoenix/components/evaluators/decision/DecisionScoringPolicyEditor";
import { DecisionVersionPicker } from "@phoenix/components/evaluators/decision/DecisionVersionPicker";
import type { DecisionEvaluatorDraft } from "@phoenix/components/evaluators/decision/useDecisionEvaluatorDraft";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import { DecisionPromptEditor } from "@phoenix/pages/playground/DecisionPromptEditor";
import { DecisionVersionSelector } from "@phoenix/pages/playground/DecisionVersionSelector";
import { PlaygroundInstanceModelControls } from "@phoenix/pages/playground/PlaygroundInstanceControls";
import { TemplateFormatRadioGroup } from "@phoenix/pages/playground/TemplateFormatRadioGroup";

/**
 * A decision evaluator's definition: the saved version it starts from, the
 * judge model, the state and questions, and the scoring, then the dataset
 * input mapping unless `showInputMapping` is off.
 */
export function DecisionEvaluatorForm({
  draft,
  isDisabled,
  scoringDescription,
  sharedEvaluatorNote,
  showInputMapping = true,
}: {
  draft: DecisionEvaluatorDraft;
  isDisabled?: boolean;
  scoringDescription: string;
  sharedEvaluatorNote?: string;
  showInputMapping?: boolean;
}) {
  const { initialEvaluator } = draft;
  return (
    <>
      {initialEvaluator ? (
        <Alert variant="warning" title="Shared evaluator">
          Decision and scoring changes affect every dataset and online evaluator
          using this evaluator.
          {sharedEvaluatorNote ? ` ${sharedEvaluatorNote}` : ""} Saving
          definition changes creates a new Decision version.
        </Alert>
      ) : null}
      {initialEvaluator ? (
        <DecisionVersionSelector
          decision={{
            id: initialEvaluator.decisionVersion.decision.id,
            name: initialEvaluator.decisionVersion.decision.name,
            versionId:
              draft.loadedVersionId ?? initialEvaluator.decisionVersion.id,
            tag: draft.selectedTagName,
          }}
          onSelectVersion={draft.selectVersion}
          onSelectTag={draft.selectTag}
        />
      ) : (
        <DecisionVersionPicker
          value={draft.selection}
          isDisabled={isDisabled}
          onChange={draft.pickVersion}
        />
      )}
      <Text color="text-500" size="S">
        {initialEvaluator
          ? `Editing ${initialEvaluator.decisionVersion.decision.name}. Select another version of this Decision to start from.`
          : "Author a Decision below, or select a saved version to start from."}
      </Text>
      {draft.isLoading ? (
        <Loading />
      ) : (
        <>
          <EvaluatorSectionHeader
            title="Decision"
            description="Write the state and questions this evaluator sends."
            extra={
              <Flex direction="row" gap="size-100" alignItems="center">
                <Suspense fallback={<Loading />}>
                  <PlaygroundInstanceModelControls
                    instanceId={DECISION_EVALUATOR_DRAFT_INSTANCE_ID}
                    supportsDecisionModels
                    fixedModelType="DECISION"
                    credentialSource="server"
                    disableEphemeralRouting
                  />
                </Suspense>
                <TemplateFormatRadioGroup size="S" showNoneOption={false} />
              </Flex>
            }
          />
          <DecisionPromptEditor
            playgroundInstanceId={DECISION_EVALUATOR_DRAFT_INSTANCE_ID}
          />
          <EvaluatorSectionHeader
            title="Scoring"
            description={scoringDescription}
          />
          <DecisionScoringPolicyEditor
            questions={draft.questions}
            value={draft.policy}
            onChange={draft.setPolicy}
            isDisabled={isDisabled}
          />
        </>
      )}
      {showInputMapping ? (
        <>
          <EvaluatorSectionHeader
            title="Input mapping"
            description="Inputs named input, output, reference, or metadata fill from the example when left blank."
          />
          <EvaluatorInputMapping />
        </>
      ) : null}
    </>
  );
}
