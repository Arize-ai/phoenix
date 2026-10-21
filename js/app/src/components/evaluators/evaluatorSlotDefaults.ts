export const EVALUATOR_SLOT_NAMES = ["input", "output", "metadata"] as const;

export type EvaluatorSlotName = (typeof EVALUATOR_SLOT_NAMES)[number];

/**
 * Whether a variable binds without a mapping. Left unmapped, a variable reads
 * the context field of the same name, and the context has only these three.
 */
export function isEvaluatorSlotName(name: string): name is EvaluatorSlotName {
  return (EVALUATOR_SLOT_NAMES as readonly string[]).includes(name);
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
