import type { GenerativeModelSDK } from "@phoenix/constants/generativeConstants";

export type DecisionSDK = "OPENAI" | "TYPESAFE";

export const DECISION_SDK_LABELS: Record<DecisionSDK, string> = {
  OPENAI: "OpenAI Decisions API",
  TYPESAFE: "System One",
};

/**
 * Mirrors `sdk_offers_decisions` in `src/phoenix/db/types/model_provider.py`.
 */
export function sdkCanServeDecisions(
  sdk: GenerativeModelSDK
): sdk is DecisionSDK {
  return sdk === "OPENAI" || sdk === "TYPESAFE";
}
