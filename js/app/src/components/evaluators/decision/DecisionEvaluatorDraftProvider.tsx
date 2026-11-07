import { type ReactNode, useState } from "react";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import {
  DEFAULT_DECISION_MODEL_NAME,
  DEFAULT_DECISION_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import { PlaygroundProvider } from "@phoenix/contexts/PlaygroundContext";
import {
  createDecisionQuestion,
  createDecisionStateDraft,
} from "@phoenix/pages/playground/decisionUtils";
import {
  createDecisionTaskInstance,
  type DecisionPromptDraft,
} from "@phoenix/store/playground";

export const DECISION_EVALUATOR_DRAFT_INSTANCE_ID = 1;

/** Where a decision evaluator is bound: a dataset's examples or a project's records. */
type DecisionEvaluatorSurface = "dataset" | "project";

const STARTER_DRAFTS: Record<
  DecisionEvaluatorSurface,
  { state: string; instructions: string }
> = {
  dataset: {
    state: "{{output}}",
    instructions: "Is the output relevant to the request?",
  },
  project: {
    state: "Request:\n{{input}}\n\nResponse:\n{{output}}",
    instructions: "Does the response address the request?",
  },
};

/**
 * The draft a new decision evaluator starts from: a state over variables the
 * surface's records fill without a mapping, and one yes / no question.
 */
function createDefaultDecisionEvaluatorDraft(
  surface: DecisionEvaluatorSurface
): DecisionPromptDraft {
  const { state, instructions } = STARTER_DRAFTS[surface];
  return {
    state: createDecisionStateDraft({ text: state }),
    questions: [
      createDecisionQuestion({
        type: "predicate",
        name: "relevant",
        instructions,
      }),
    ],
  };
}

/**
 * Holds a decision evaluator's draft in a single-instance playground store,
 * so the form edits it with the playground's own decision editors. A new
 * draft starts on the default decision model, so it can be tested and saved
 * as soon as it opens.
 */
export function DecisionEvaluatorDraftProvider({
  surface,
  children,
}: {
  surface: DecisionEvaluatorSurface;
  children: ReactNode;
}) {
  const [instances] = useState(() => {
    const instance = createDecisionTaskInstance();
    return [
      {
        ...instance,
        id: DECISION_EVALUATOR_DRAFT_INSTANCE_ID,
        model: {
          ...instance.model,
          provider: DEFAULT_DECISION_MODEL_PROVIDER,
          modelName: DEFAULT_DECISION_MODEL_NAME,
        },
        decisionPrompt: createDefaultDecisionEvaluatorDraft(surface),
      },
    ];
  });
  return (
    <PlaygroundProvider
      modelConfigByProvider={{}}
      instances={instances}
      templateFormat={TemplateFormats.Mustache}
    >
      {children}
    </PlaygroundProvider>
  );
}
