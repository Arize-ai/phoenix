/** Where every playground operation is mounted, whatever kind of task the page holds. */
export const PLAYGROUND_ROUTE_HINT = "the Playground page (/playground)";

/**
 * For the operations that act on an instance's prompt: on an evaluator page
 * that prompt is the LLM evaluator's judge prompt.
 */
export const PLAYGROUND_PROMPT_ROUTE_HINT =
  "the Playground page (/playground); on an evaluator page it acts on the " +
  "LLM evaluator's judge prompt, which is the instance's prompt";
