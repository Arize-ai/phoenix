import { type ReactNode, useState } from "react";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { PlaygroundProvider } from "@phoenix/contexts/PlaygroundContext";
import {
  createDecisionTaskInstance,
  type DecisionPromptDraft,
} from "@phoenix/store/playground";

export const DECISION_EVALUATOR_DRAFT_INSTANCE_ID = 1;

/**
 * Holds a decision evaluator's draft in a single-instance playground store,
 * so the form edits it with the playground's own decision editors.
 */
export function DecisionEvaluatorDraftProvider({
  defaultDraft,
  children,
}: {
  defaultDraft: DecisionPromptDraft;
  children: ReactNode;
}) {
  const [instances] = useState(() => [
    {
      ...createDecisionTaskInstance(),
      id: DECISION_EVALUATOR_DRAFT_INSTANCE_ID,
      decisionPrompt: defaultDraft,
    },
  ]);
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
