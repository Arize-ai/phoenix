import type { GenerativeModelSDK } from "@phoenix/constants/generativeConstants";

export type DecisionSDK = "OPENAI" | "TYPESAFE" | "GOOGLE_GENAI";

export const DECISION_SDK_LABELS: Record<DecisionSDK, string> = {
  OPENAI: "OpenAI Decisions API",
  TYPESAFE: "System One",
  GOOGLE_GENAI: "Gemini Decisions API",
};

/**
 * Mirrors `sdk_offers_decisions` in `src/phoenix/db/types/model_provider.py`.
 */
export function sdkCanServeDecisions(
  sdk: GenerativeModelSDK
): sdk is DecisionSDK {
  return sdk === "OPENAI" || sdk === "TYPESAFE" || sdk === "GOOGLE_GENAI";
}
