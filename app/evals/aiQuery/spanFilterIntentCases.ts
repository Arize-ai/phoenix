/**
 * A natural-language request whose correct translation requires capturing
 * what the user is hunting rather than echoing their words. There is no
 * accepted-expression list: many expansions are right (different synonym
 * sets, root forms, `or`-combinations), so grading belongs to the intent
 * judge, guided by the structured expectations below.
 */
export type SpanFilterIntentEvalCase = {
  /** Stable example id — keeps experiment runs upserting onto the same dataset example. */
  id: string;
  /** The natural-language request a user would type. */
  query: string;
  /** What the user is actually hunting, stated as ground truth for the judge. */
  phenomenon: string;
  /** The field(s) where data exhibiting the phenomenon lives. */
  expectedFields: string[];
  /**
   * The field(s) a confused translation reaches for instead — searched by
   * the code-side field check, never shown to the judge.
   */
  wrongFields: string[];
  /**
   * Surface forms that would actually appear in matching data. Illustrative
   * for the judge, not an exhaustive or required list — an expression may
   * capture the intent with terms not listed here.
   */
  surfaceForms: string[];
  /**
   * The specific wrong answer this case exists to catch — the reason it
   * has a slot in the suite.
   */
  failureMode: string;
};

/**
 * Requests where the concept word the user typed would not appear verbatim
 * in matching data, so a faithful translation must expand the query: search
 * the right side of the conversation for the surface forms the phenomenon
 * actually leaves in text. The motivating failure — "there is an apology in
 * the response" answered with `'apology' in input.value` — misses on both
 * axes at once: wrong field, and a search term real apologies never contain.
 *
 * Kept apart from `spanFilterCases`: those grade against accepted
 * expressions (with an equivalence judge for shape variation), while these
 * have no single right answer and grade on whether the intent was captured.
 */
export const spanFilterIntentCases: SpanFilterIntentEvalCase[] = [
  {
    id: "apology-in-response",
    query: "there is an apology in the response",
    phenomenon: "the assistant apologizes somewhere in its response",
    expectedFields: ["output.value"],
    wrongFields: ["input.value"],
    surfaceForms: ["sorry", "apolog", "I apologize", "regret"],
    failureMode:
      "echoes 'apology' as the search term (real apologies say 'sorry' or 'I apologize') or searches the input instead of the response",
  },
  {
    id: "refusal-in-response",
    query: "responses where the model refused to answer",
    phenomenon: "the assistant declines the request instead of answering it",
    expectedFields: ["output.value"],
    wrongFields: ["input.value"],
    surfaceForms: ["I can't", "cannot", "unable to", "I won't", "not able to"],
    failureMode: "searches for 'refused', a word refusals almost never contain",
  },
  {
    id: "frustrated-user",
    query: "messages where the user sounds frustrated",
    phenomenon: "the user expresses frustration in what they typed",
    expectedFields: ["input.value"],
    wrongFields: ["output.value"],
    surfaceForms: [
      "not working",
      "still doesn't",
      "ridiculous",
      "useless",
      "third time",
    ],
    failureMode:
      "searches for 'frustrated' itself, or reads the assistant's output for the user's mood",
  },
  {
    id: "hedged-answer",
    query: "answers where the model hedged",
    phenomenon: "the assistant qualifies its answer instead of committing",
    expectedFields: ["output.value"],
    wrongFields: ["input.value"],
    surfaceForms: [
      "I'm not sure",
      "might",
      "it depends",
      "I believe",
      "can't be certain",
    ],
    failureMode:
      "searches for 'hedge' or 'hedged', jargon no model output contains",
  },
  {
    id: "user-wants-human",
    query: "the user asked for a human",
    phenomenon:
      "the user asks to be handed to a person instead of the assistant",
    expectedFields: ["input.value"],
    wrongFields: ["output.value"],
    surfaceForms: [
      "human",
      "real person",
      "agent",
      "representative",
      "speak to someone",
    ],
    // Included as the control: here the concept word IS a surface form, so
    // a faithful literal answer must pass — the judge may not demand
    // expansion where none is needed
    failureMode:
      "searches the response for the request, or collapses to the full phrase 'asked for a human' that no user types",
  },
  {
    id: "gratitude-input",
    query: "conversations where the user expressed gratitude",
    phenomenon: "the user thanks the assistant",
    expectedFields: ["input.value"],
    wrongFields: ["output.value"],
    surfaceForms: ["thank", "thanks", "appreciate", "grateful"],
    failureMode:
      "searches for 'gratitude' or 'expressed gratitude', phrasing thankful users never type",
  },
];
