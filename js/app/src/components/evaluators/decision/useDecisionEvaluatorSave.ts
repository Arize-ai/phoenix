import { pickDeclaredInputMapping } from "@phoenix/components/evaluators/decision/decisionEvaluatorUtils";
import type { DecisionEvaluatorDraft } from "@phoenix/components/evaluators/decision/useDecisionEvaluatorDraft";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

/** The store's input mapping, limited to the variables the evaluator declares. */
export function useDeclaredInputMapping(variables: readonly string[]) {
  const store = useEvaluatorStoreInstance();
  return () =>
    pickDeclaredInputMapping(
      store.getState().evaluator.inputMapping,
      variables
    );
}

/**
 * Validates a decision evaluator form and builds the fields its create or
 * update mutation sends. Each builder throws the message the form shows.
 */
export function useDecisionEvaluatorSave(draft: DecisionEvaluatorDraft) {
  const store = useEvaluatorStoreInstance();
  const getInputMapping = useDeclaredInputMapping(draft.variables);
  const buildSharedInput = async (name: string) => {
    if (!(await store.getState().validateAll())) {
      throw new Error("Fix the highlighted fields before saving.");
    }
    const trimmedName = name.trim();
    draft.getDefinition(trimmedName);
    return {
      name: trimmedName,
      description: store.getState().evaluator.description.trim() || null,
      inputMapping: getInputMapping(),
      scoringPolicy: draft.policy,
    };
  };
  return {
    getInputMapping,
    buildCreateInput: async (name: string) => {
      const input = await buildSharedInput(name);
      if (validateIdentifier(input.name) !== true) {
        throw new Error("Enter a valid evaluator name.");
      }
      return {
        ...input,
        evaluatorName: input.name,
        ...draft.getCreateDecisionSource(),
      };
    },
    buildUpdateInput: async (name: string) => ({
      ...(await buildSharedInput(name)),
      ...draft.getUpdateDecisionSource(),
    }),
  };
}
