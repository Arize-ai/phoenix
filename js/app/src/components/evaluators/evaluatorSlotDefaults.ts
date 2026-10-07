import type { ProjectEvaluatorRecordKind } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

export const EVALUATOR_SLOT_NAMES = ["input", "output", "metadata"] as const;

export type EvaluatorSlotName = (typeof EVALUATOR_SLOT_NAMES)[number];

/**
 * Whether a variable binds without a mapping. Left unmapped, a variable reads
 * the context field of the same name, and the context has only these three.
 */
export function isEvaluatorSlotName(name: string): name is EvaluatorSlotName {
  return (EVALUATOR_SLOT_NAMES as readonly string[]).includes(name);
}

export type EvaluatorSuggestedPath = {
  path: string;
  description: string;
};

/**
 * Paths pinned above the context's own field list while a variable is
 * unmapped, described by what they reach. Each is offered only when it
 * resolves on the sampled record.
 */
const SUGGESTED_PATHS: Record<
  ProjectEvaluatorRecordKind,
  readonly EvaluatorSuggestedPath[]
> = {
  span: [
    {
      path: "input.messages[-1].content",
      description: "Last message sent to the model",
    },
    { path: "input.messages", description: "Messages sent to the model" },
    { path: "input.tools", description: "Tools the model could call" },
    {
      path: "output.messages[-1].tool_calls",
      description: "Tool calls the model made",
    },
    { path: "output.messages[-1].content", description: "The model's reply" },
    {
      path: "output.documents[*].content",
      description: "Retrieved documents' content",
    },
    {
      path: "output.documents[0].content",
      description: "First retrieved document",
    },
  ],
  trace: [
    { path: "input", description: "Request input" },
    { path: "output", description: "Final output" },
    { path: "metadata.attributes", description: "Root span attributes" },
  ],
  session: [
    {
      path: "metadata.turns[-1].input",
      description: "Last turn's user input",
    },
    { path: "metadata.turns[-1].output", description: "Last turn's response" },
    { path: "metadata.turns[:-1]", description: "Earlier turns" },
    { path: "metadata.turns[*].input", description: "Every user input" },
    { path: "metadata.first_input", description: "First user input" },
  ],
};

export function getEvaluatorSuggestedPaths(
  recordKind: ProjectEvaluatorRecordKind
): readonly EvaluatorSuggestedPath[] {
  return SUGGESTED_PATHS[recordKind];
}

const PLACEHOLDER_TEXT_LENGTH = 60;

/**
 * What an evaluator input's empty path field shows: what the input reads while
 * no path is set. Saved text wins, since the server applies it over anything
 * else; then a default input's own field; otherwise nothing, which a required
 * input cannot run with.
 */
export function getEvaluatorInputPlaceholder({
  variableName,
  isRequired,
  literal,
}: {
  variableName: string;
  isRequired: boolean;
  /** Text saved for the input, if any. */
  literal?: string | number | boolean;
}): string {
  if (literal !== undefined) {
    const text = JSON.stringify(literal);
    return text.length > PLACEHOLDER_TEXT_LENGTH
      ? `${text.slice(0, PLACEHOLDER_TEXT_LENGTH - 1)}…`
      : text;
  }
  if (isEvaluatorSlotName(variableName)) {
    return variableName;
  }
  return isRequired ? "Required" : "Optional";
}
