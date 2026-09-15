import type { components } from "../__generated__/api/v1";

/**
 * A shared evaluator definition as returned by the Phoenix REST API. The
 * `type` field discriminates the variants.
 */
export type EvaluatorDefinition =
  components["schemas"]["EvaluatorDefinitionResponseBody"]["data"];

/**
 * The kinds of evaluator definition, as used by the `type` filter when listing.
 */
export type EvaluatorType = EvaluatorDefinition["type"];

/**
 * A shared LLM evaluator definition.
 */
export type LLMEvaluatorDefinition =
  components["schemas"]["LLMEvaluatorDefinition"];

/**
 * A shared code evaluator definition.
 */
export type CodeEvaluatorDefinition =
  components["schemas"]["CodeEvaluatorDefinition"];

/**
 * One immutable version of a code evaluator's source.
 */
export type CodeEvaluatorVersion =
  components["schemas"]["CodeEvaluatorVersion"];

/**
 * The result of appending code to a code evaluator. `was_created` is `false`
 * when the source matched the current version, which is returned instead.
 */
export type CreatedCodeEvaluatorVersion =
  components["schemas"]["CreatedCodeEvaluatorVersion"];

/**
 * A code evaluator to create on its own, before anything binds it.
 */
export type CodeEvaluatorCreate =
  components["schemas"]["CreateCodeEvaluatorRequest"];

/**
 * A new code version and the configuration to apply with it.
 */
export type CodeEvaluatorVersionCreate =
  components["schemas"]["CodeEvaluatorVersionRequest"];

/**
 * Fields that can change on a shared LLM evaluator. Omitted fields keep their
 * current values. Prompt content is edited through the prompts API; the patch
 * only records which prompt version the evaluator runs.
 */
export type LLMEvaluatorPatch =
  components["schemas"]["PatchLLMEvaluatorRequest"];

/**
 * Fields that can change on a shared code evaluator. Omitted fields keep
 * their current values.
 */
export type CodeEvaluatorPatch =
  components["schemas"]["PatchCodeEvaluatorRequest"];

/**
 * A patch for a shared evaluator definition. `type` selects the variant and
 * must match the evaluator being updated.
 */
export type EvaluatorPatch = LLMEvaluatorPatch | CodeEvaluatorPatch;

/**
 * How record fields map onto evaluator arguments.
 */
export type EvaluatorInputMapping = components["schemas"]["InputMapping"];

/**
 * An output configuration an evaluator can produce.
 */
export type EvaluatorOutputConfig =
  CodeEvaluatorDefinition["output_configs"][number];
