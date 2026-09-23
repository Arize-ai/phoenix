import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * A small Google model standing in for a tier AI query actually runs on,
 * with the bar its experiment must clear.
 */
export type AIQueryEvalModel = {
  /** Gemini API model id */
  modelId: string;
  /** The tier of the AI query feature this model simulates. */
  simulates: string;
  /** The `filter_correct` pass rate the span and experiment-run correctness suites must reach to pass. */
  minPassRate: number;
  sessionMinPassRate: number;
  /**
   * The `intent_captured` pass rate the intent suite must reach to pass.
   * Kept on the model entry (rather than a lookup keyed by model id) so
   * adding a model cannot silently ship without an intent bar.
   */
  intentMinPassRate: number;
};

/**
 * The evaluation matrix. Gemma is Gemini Nano's open-model family (and,
 * like the browser Prompt API, the SDK folds the system prompt into the
 * first user turn for it), so the ~4B-active Gemma proxies the default
 * on-device browser-model path. The flash-lite tiers are the smallest
 * hosted Geminis a user would plausibly configure as a provider model.
 */
export const GOOGLE_EVAL_MODELS: AIQueryEvalModel[] = [
  {
    modelId: "gemma-4-26b-a4b-it",
    simulates: "Gemini Nano (on-device class, ~4B active params)",
    minPassRate: 0.75,
    sessionMinPassRate: 0.85,
    intentMinPassRate: 0.5,
  },
  {
    modelId: "gemini-3.1-flash-lite",
    simulates: "small hosted provider model",
    minPassRate: 0.85,
    sessionMinPassRate: 0.85,
    intentMinPassRate: 0.65,
  },
  {
    modelId: "gemini-3.5-flash-lite",
    simulates: "smallest current hosted provider model",
    minPassRate: 0.85,
    sessionMinPassRate: 0.85,
    intentMinPassRate: 0.65,
  },
];

/**
 * The model that judges expression equivalence when the exact-match check
 * misses. Deliberately a tier above every model under test.
 */
export const JUDGE_MODEL_ID = "gemini-3.5-flash";

export const googleApiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;

export function createGoogleEvalModel(modelId: string) {
  return createGoogleGenerativeAI({ apiKey: googleApiKey })(modelId);
}
