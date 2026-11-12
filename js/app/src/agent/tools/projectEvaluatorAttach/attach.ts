import { z } from "zod";

import type { EvaluatorInputMapping } from "@phoenix/types";

/** What `evaluators.project.attach.read` returns. */
export type ProjectEvaluatorAttachSnapshot = {
  /** The existing evaluator the form attaches. */
  evaluatorId: string;
  name: string;
  kind: "CODE" | "DECISION";
  /** The inputs the evaluator reads; each is mapped from the record. */
  variables: string[];
  /** The inputs that must resolve on a record for it to be evaluated. */
  requiredVariables: string[];
  /** What each input should hold, as the evaluator's author described it. */
  inputDescriptions: Record<string, string>;
  /** The mapping the project will read through once attached. */
  inputMapping: EvaluatorInputMapping;
  /** True while the mapping is still the one the form opened with. */
  isDefaultMapping: boolean;
};

const literalValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const editProjectEvaluatorAttachInputSchema = z.strictObject({
  inputMapping: z
    .strictObject({
      pathMapping: z
        .record(z.string(), z.string())
        .optional()
        .describe(
          "Input name → path on the record (e.g. `output` → `attributes.output.value`). " +
            "Replaces the whole path mapping when given."
        ),
      literalMapping: z
        .record(z.string(), literalValueSchema)
        .optional()
        .describe(
          "Input name → fixed value. Replaces the whole literal mapping when given."
        ),
    })
    .describe(
      "The project's mapping from the evaluator's inputs to the record."
    ),
});

export type EditProjectEvaluatorAttachInput = z.output<
  typeof editProjectEvaluatorAttachInputSchema
>;

/**
 * The mapping an edit asks for, or why it cannot apply. Only the
 * evaluator's own inputs can be mapped; the other half of the mapping is
 * kept when an edit gives one half.
 */
export function applyProjectEvaluatorAttachEdit({
  snapshot,
  input,
}: {
  snapshot: ProjectEvaluatorAttachSnapshot;
  input: EditProjectEvaluatorAttachInput;
}):
  | { ok: true; inputMapping: EvaluatorInputMapping }
  | { ok: false; error: string } {
  const inputMapping: EvaluatorInputMapping = {
    pathMapping:
      input.inputMapping.pathMapping ?? snapshot.inputMapping.pathMapping,
    literalMapping:
      input.inputMapping.literalMapping ?? snapshot.inputMapping.literalMapping,
  };
  const known = new Set(snapshot.variables);
  const unknown = [
    ...Object.keys(inputMapping.pathMapping),
    ...Object.keys(inputMapping.literalMapping),
  ].filter((name) => !known.has(name));
  if (unknown.length > 0) {
    return {
      ok: false,
      error:
        `${snapshot.name} has no input named ${[...new Set(unknown)].join(", ")}. ` +
        `Its inputs are: ${snapshot.variables.join(", ") || "(none)"}. The mapping was not changed.`,
    };
  }
  return { ok: true, inputMapping };
}
