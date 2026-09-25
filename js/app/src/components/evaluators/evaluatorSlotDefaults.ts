import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

export const EVALUATOR_SLOT_NAMES = ["input", "output", "metadata"] as const;

export type EvaluatorSlotName = (typeof EVALUATOR_SLOT_NAMES)[number];

/**
 * Whether a variable binds without a mapping. Left unmapped, a variable reads
 * the context field of the same name, and the context has only these three.
 */
export function isEvaluatorSlotName(name: string): name is EvaluatorSlotName {
  return (EVALUATOR_SLOT_NAMES as readonly string[]).includes(name);
}

/**
 * The inputs a project evaluator's mapping form lists: the three the record
 * always offers, then the evaluator's own variables in the order it declares
 * them.
 */
export function getEvaluatorMappingRowNames(
  declaredVariables: readonly string[]
): string[] {
  return [
    ...EVALUATOR_SLOT_NAMES,
    ...declaredVariables.filter((name) => !isEvaluatorSlotName(name)),
  ];
}

type BySlot<T> = Record<
  ProjectEvaluatorMappingSourceGrain,
  Record<EvaluatorSlotName, T>
>;

export type EvaluatorSlotSuggestedPath = {
  path: string;
  description: string;
};

/**
 * Paths pinned above the context's own field list while a slot is still
 * unmapped — worked examples of what a mapping can reach, from the plain
 * narrowing to the deeper cuts an author would otherwise have to discover
 * by drilling. Each is offered only when it resolves on the sampled record,
 * so nothing here can suggest a path that would fail.
 */
const SLOT_SUGGESTED_PATHS: BySlot<readonly EvaluatorSlotSuggestedPath[]> = {
  span: {
    input: [
      {
        path: "metadata.attributes.llm.input_messages",
        description: "Chat messages sent to the model.",
      },
      {
        path: "metadata.attributes.input",
        description: "Input attribute, with mime type.",
      },
    ],
    output: [
      {
        path: "metadata.attributes.llm.output_messages",
        description: "Messages the model returned.",
      },
    ],
    metadata: [
      {
        path: "metadata.attributes",
        description: "The whole attribute tree.",
      },
      {
        path: "metadata.attributes.llm",
        description: "Model, token counts, and messages.",
      },
      {
        path: "metadata.annotations",
        description: "Span annotations, by name.",
      },
    ],
  },
  trace: {
    input: [
      {
        path: "metadata.attributes.input",
        description: "The root span's input attribute, with mime type.",
      },
    ],
    output: [
      {
        path: "metadata.attributes.output",
        description: "The root span's output attribute, with mime type.",
      },
    ],
    metadata: [
      {
        path: "metadata.attributes",
        description: "The root span's whole attribute tree.",
      },
      {
        path: "metadata.trace_annotations",
        description: "Trace annotations, by name.",
      },
    ],
  },
  session: {
    input: [
      {
        path: "metadata.turns",
        description: "Every turn, oldest first.",
      },
      {
        path: "metadata.turns[0].input",
        description: "The session's opening request.",
      },
    ],
    output: [
      {
        path: "metadata.turns[0].output",
        description: "The first turn's response.",
      },
    ],
    metadata: [],
  },
};

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

const NO_SUGGESTED_PATHS: readonly EvaluatorSlotSuggestedPath[] = [];

export function getEvaluatorSlotSuggestedPaths(
  grain: ProjectEvaluatorMappingSourceGrain,
  variableName: string
): readonly EvaluatorSlotSuggestedPath[] {
  return isEvaluatorSlotName(variableName)
    ? SLOT_SUGGESTED_PATHS[grain][variableName]
    : NO_SUGGESTED_PATHS;
}
