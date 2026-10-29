import { useEffect, useState } from "react";

import { DECISION_EVALUATOR_DRAFT_INSTANCE_ID } from "@phoenix/components/evaluators/decision/DecisionEvaluatorDraftProvider";
import {
  type DecisionEvaluatorData,
  getMutationErrorMessage,
} from "@phoenix/components/evaluators/decision/decisionEvaluatorUtils";
import {
  type DecisionQuestionDefinition,
  type DecisionScoringPolicyValue,
  isPolicyValid,
  normalizePolicy,
  policyOutputToInput,
  validatePolicy,
} from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import type { DecisionVersionSelection } from "@phoenix/components/evaluators/decision/DecisionVersionPicker";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { extractDecisionVariables } from "@phoenix/pages/playground/decisionUtils";
import { fetchPlaygroundDecisionAsInstance } from "@phoenix/pages/playground/fetchPlaygroundDecision";
import { toDecisionVersionInput } from "@phoenix/pages/playground/savedDecisionUtils";
import { selectPlaygroundInstanceDecisionPrompt } from "@phoenix/store/playground/selectors";

type DecisionVersionInput = ReturnType<typeof toDecisionVersionInput>;

/** Must render inside a {@link DecisionEvaluatorDraftProvider}. */
export function useDecisionEvaluatorDraft({
  initialEvaluator,
}: {
  initialEvaluator?: DecisionEvaluatorData;
}) {
  const playground = usePlaygroundStore();
  const instance = usePlaygroundContext((state) => state.instances[0]);
  const decisionPrompt = usePlaygroundContext(
    selectPlaygroundInstanceDecisionPrompt(instance.id)
  );
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
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
  const [loadError, setLoadError] = useState<string | undefined>();
  const selectedDecisionId =
    selection?.decisionId ?? initialEvaluator?.decisionVersion.decision.id;
  const selectedVersionId = selectedTagName
    ? undefined
    : (selection?.versionId ?? initialEvaluator?.decisionVersion.id);

  useEffect(() => {
    if (!selectedDecisionId || (!selectedVersionId && !selectedTagName)) {
      return () => undefined;
    }
    let isCurrent = true;
    // eslint-disable-next-line react/set-state-in-effect -- fetch starts after this render
    setIsLoading(true);
    setIsVersionReady(false);
    setLoadError(undefined);
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
        state.loadInstance({
          instanceId: DECISION_EVALUATOR_DRAFT_INSTANCE_ID,
          instance: loaded.instance,
        });
        setLoadedVersionId(loaded.instance.decision?.versionId);
        setLoadedVersion(
          JSON.stringify(
            toDecisionVersionInput({
              instance: {
                model: loaded.instance.model,
                decisionPrompt: loaded.instance.decisionPrompt,
              },
              templateFormat: loaded.templateFormat,
            })
          )
        );
        setIsLoading(false);
        setIsVersionReady(true);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setLoadError(getMutationErrorMessage(error));
        setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [playground, selectedDecisionId, selectedVersionId, selectedTagName]);

  const questions: DecisionQuestionDefinition[] = (
    decisionPrompt?.questions ?? []
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
  const variables = extractDecisionVariables({
    draft: decisionPrompt!,
    templateFormat,
  });
  const policy = normalizePolicy(questions, policyDraft);
  const readVersion = (purpose: "save" | "test") =>
    toDecisionVersionInput({
      instance: { model: instance.model, decisionPrompt },
      templateFormat,
      purpose,
    });
  let version: DecisionVersionInput | null = null;
  let draftError: string | null = null;
  try {
    version = readVersion("save");
  } catch (error) {
    draftError = getMutationErrorMessage(error);
  }
  const hasDecisionChanges =
    loadedVersion == null || JSON.stringify(version) !== loadedVersion;

  const getDefinition = (name: string, purpose: "save" | "test" = "save") => {
    if (isLoading || !isVersionReady)
      throw new Error("Load a Decision version before continuing.");
    const current = purpose === "test" ? readVersion("test") : version;
    if (!current)
      throw new Error(draftError ?? "Complete the Decision definition.");
    if (!isPolicyValid(validatePolicy(policy)))
      throw new Error("Fix the scoring settings before continuing.");
    return { name, decisionVersion: current, scoringPolicy: policy };
  };

  const getCreateDecisionSource = () =>
    hasDecisionChanges
      ? { decisionVersion: version, decisionId: selectedDecisionId }
      : { decisionVersionId: loadedVersionId };

  const getUpdateDecisionSource = () =>
    hasDecisionChanges
      ? { decisionVersion: version }
      : loadedVersionId !== initialEvaluator?.decisionVersion.id
        ? { decisionVersionId: loadedVersionId }
        : {};

  return {
    initialEvaluator,
    selection,
    selectedTagName,
    loadedVersionId,
    hasDecisionChanges,
    isLoading,
    isVersionReady,
    loadError,
    questions,
    variables,
    policy,
    setPolicy: setPolicyDraft,
    pickVersion: (next: DecisionVersionSelection | null) => {
      setSelection(next);
      setPolicyDraft(null);
    },
    selectVersion: (versionId: string) => {
      if (!initialEvaluator) return;
      setSelectedTagName(null);
      setSelection({
        decisionId: initialEvaluator.decisionVersion.decision.id,
        decisionName: initialEvaluator.decisionVersion.decision.name,
        versionId,
        tagName: null,
        inputs: [],
        questions: [],
      });
    },
    selectTag: setSelectedTagName,
    getDefinition,
    getCreateDecisionSource,
    getUpdateDecisionSource,
  };
}

export type DecisionEvaluatorDraft = ReturnType<
  typeof useDecisionEvaluatorDraft
>;
