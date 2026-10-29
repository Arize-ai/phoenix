import { Suspense } from "react";

import { Alert, Flex, Loading, Text } from "@phoenix/components";
import { DECISION_EVALUATOR_DRAFT_INSTANCE_ID } from "@phoenix/components/evaluators/decision/DecisionEvaluatorDraftProvider";
import { DecisionScoringPolicyEditor } from "@phoenix/components/evaluators/decision/DecisionScoringPolicyEditor";
import { DecisionVersionPicker } from "@phoenix/components/evaluators/decision/DecisionVersionPicker";
import type { DecisionEvaluatorDraft } from "@phoenix/components/evaluators/decision/useDecisionEvaluatorDraft";
import { EvaluatorSectionHeader } from "@phoenix/components/evaluators/EvaluatorSectionHeader";
import { ModelMenu } from "@phoenix/components/generative";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { DecisionPromptEditor } from "@phoenix/pages/playground/DecisionPromptEditor";
import { DecisionVersionSelector } from "@phoenix/pages/playground/DecisionVersionSelector";
import { TemplateFormatRadioGroup } from "@phoenix/pages/playground/TemplateFormatRadioGroup";

export function DecisionEvaluatorDefinitionFields({
  draft,
  isDisabled,
  scoringDescription,
  sharedEvaluatorNote,
}: {
  draft: DecisionEvaluatorDraft;
  isDisabled?: boolean;
  scoringDescription: string;
  sharedEvaluatorNote?: string;
}) {
  const playground = usePlaygroundStore();
  const model = usePlaygroundContext((state) => state.instances[0].model);
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
                  <ModelMenu
                    supportsDecisionModels
                    fixedModelType="DECISION"
                    credentialSource="server"
                    value={
                      model.modelName
                        ? {
                            provider: model.provider,
                            modelName: model.modelName,
                            modelType: "DECISION",
                            customProvider: model.customProvider ?? undefined,
                          }
                        : null
                    }
                    onChange={(next) =>
                      playground.getState().updateInstance({
                        instanceId: DECISION_EVALUATOR_DRAFT_INSTANCE_ID,
                        patch: {
                          model: {
                            ...model,
                            provider: next.provider,
                            modelName: next.modelName,
                            modelType: "DECISION",
                            customProvider: next.customProvider ?? null,
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
    </>
  );
}
