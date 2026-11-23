import { Suspense, useCallback, useEffect, useState } from "react";

import {
  Alert,
  CompositeField,
  Flex,
  Loading,
  View,
} from "@phoenix/components";
import { DecisionPromptEditor } from "@phoenix/components/decision/DecisionPromptEditor";
import { DecisionVersionSelector } from "@phoenix/components/decision/DecisionVersionSelector";
import { DECISION_EVALUATOR_DRAFT_INSTANCE_ID } from "@phoenix/components/evaluators/decision/DecisionEvaluatorDraftProvider";
import { DecisionMenu } from "@phoenix/components/evaluators/decision/DecisionMenu";
import { DecisionScoringPolicyEditor } from "@phoenix/components/evaluators/decision/DecisionScoringPolicyEditor";
import { DecisionVersionPicker } from "@phoenix/components/evaluators/decision/DecisionVersionPicker";
import type { DecisionEvaluatorDraft } from "@phoenix/components/evaluators/decision/useDecisionEvaluatorDraft";
import type { EvaluatorFormSection } from "@phoenix/components/evaluators/EvaluatorFormLayout";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import {
  createDecisionDraft,
  hasDecisionErrors,
  validateDecisionDraft,
} from "@phoenix/components/playground/decisionUtils";
import { PlaygroundInstanceModelControls } from "@phoenix/components/playground/model/PlaygroundInstanceModelControls";
import { sourceMenuContainerCSS } from "@phoenix/components/playground/searchablePickerStyles";
import { TemplateFormatRadioGroup } from "@phoenix/components/playground/TemplateFormatRadioGroup";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { selectPlaygroundInstanceDecisionPrompt } from "@phoenix/store/playground/selectors";

/**
 * A decision evaluator's definition, as the tabs of an evaluator form: the
 * decision, then how its answers are scored.
 */
export function makeDecisionEvaluatorSections({
  draft,
  isDisabled,
  scoringDescription,
  sharedEvaluatorNote,
}: {
  draft: DecisionEvaluatorDraft;
  isDisabled?: boolean;
  scoringDescription: string;
  sharedEvaluatorNote?: string;
}): EvaluatorFormSection[] {
  return [
    {
      id: "decision",
      title: "Decision",
      content: (
        <DecisionEvaluatorForm
          draft={draft}
          isDisabled={isDisabled}
          sharedEvaluatorNote={sharedEvaluatorNote}
        />
      ),
    },
    {
      id: "scoring",
      title: "Scoring",
      content: (
        <DecisionEvaluatorScoring
          draft={draft}
          isDisabled={isDisabled}
          scoringDescription={scoringDescription}
        />
      ),
    },
  ];
}

/**
 * A decision evaluator's decision, laid out like the LLM evaluator form: a
 * section header, then a row with the saved decision and its version on the
 * left and the judge model on the right, then the state and questions.
 */
function DecisionEvaluatorForm({
  draft,
  isDisabled,
  sharedEvaluatorNote,
}: {
  draft: DecisionEvaluatorDraft;
  isDisabled?: boolean;
  sharedEvaluatorNote?: string;
}) {
  const { initialEvaluator } = draft;
  const evaluatorStore = useEvaluatorStoreInstance();
  const playgroundStore = usePlaygroundStore();
  const [showAllDecisionErrors, setShowAllDecisionErrors] = useState(false);
  const triggerDecisionValidation = useCallback(async () => {
    setShowAllDecisionErrors(true);
    const state = playgroundStore.getState();
    const decisionDraft =
      selectPlaygroundInstanceDecisionPrompt(
        DECISION_EVALUATOR_DRAFT_INSTANCE_ID
      )(state) ?? createDecisionDraft();
    return !hasDecisionErrors(
      validateDecisionDraft({
        draft: decisionDraft,
        templateFormat: state.templateFormat,
      })
    );
  }, [playgroundStore]);
  useEffect(() => {
    const unregister = evaluatorStore
      .getState()
      .registerValidator("decisionPrompt", triggerDecisionValidation);
    return unregister;
  }, [evaluatorStore, triggerDecisionValidation]);
  return (
    <>
      {initialEvaluator ? (
        <View marginBottom="size-200" flex="none">
          <Alert variant="warning" title="Shared evaluator">
            Decision and scoring changes affect every dataset and online
            evaluator using this evaluator.
            {sharedEvaluatorNote ? ` ${sharedEvaluatorNote}` : ""} Saving
            definition changes creates a new Decision version.
          </Alert>
        </View>
      ) : null}
      <View marginBottom="size-200" flex="none">
        <EvaluatorSectionHeader
          title="Evaluator Decision"
          description="Write the state and questions this evaluator sends to the model."
          extra={<TemplateFormatRadioGroup size="S" showNoneOption={false} />}
        />
      </View>
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="start"
        gap="size-100"
      >
        {initialEvaluator ? (
          <div css={sourceMenuContainerCSS}>
            <CompositeField>
              <DecisionMenu
                decisions={[]}
                selectedDecision={initialEvaluator.decisionVersion.decision}
                isDisabled
                hasVersionSelector
                onSelectDecision={() => undefined}
              />
              <DecisionVersionSelector
                decision={{
                  id: initialEvaluator.decisionVersion.decision.id,
                  name: initialEvaluator.decisionVersion.decision.name,
                  versionId:
                    draft.loadedVersionId ??
                    initialEvaluator.decisionVersion.id,
                  tag: draft.selectedTagName,
                }}
                onSelectVersion={draft.selectVersion}
                onSelectTag={draft.selectTag}
              />
            </CompositeField>
          </div>
        ) : (
          <DecisionVersionPicker
            value={draft.selection}
            isDisabled={isDisabled}
            onChange={draft.pickVersion}
          />
        )}
        <Flex direction="row" gap="size-100" flex="none">
          <Suspense fallback={<Loading size="S" />}>
            <PlaygroundInstanceModelControls
              instanceId={DECISION_EVALUATOR_DRAFT_INSTANCE_ID}
              modelTypes="DECISION"
              credentialSource="server"
              routing="configured"
            />
          </Suspense>
        </Flex>
      </Flex>
      {draft.isLoading ? (
        <Loading />
      ) : (
        <View paddingY="size-100" marginBottom="size-200" flex="none">
          <DecisionPromptEditor
            playgroundInstanceId={DECISION_EVALUATOR_DRAFT_INSTANCE_ID}
            showAllErrors={showAllDecisionErrors}
          />
        </View>
      )}
    </>
  );
}

/** How a decision's answers become the score the evaluator records. */
function DecisionEvaluatorScoring({
  draft,
  isDisabled,
  scoringDescription,
}: {
  draft: DecisionEvaluatorDraft;
  isDisabled?: boolean;
  scoringDescription: string;
}) {
  if (draft.isLoading) {
    return <Loading />;
  }
  return (
    <Flex direction="column" gap="size-100">
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
    </Flex>
  );
}
