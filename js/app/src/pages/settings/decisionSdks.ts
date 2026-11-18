import type { GenerativeModelSDK } from "@phoenix/constants/generativeConstants";

export type DecisionSDK =
  | "OPENAI"
  | "AZURE_OPENAI"
  | "TYPESAFE"
  | "GOOGLE_GENAI";

/**
 * Mirrors `sdk_offers_decisions` in `src/phoenix/db/types/model_provider.py`.
 */
export function sdkCanServeDecisions(
  sdk: GenerativeModelSDK
): sdk is DecisionSDK {
  return (
    sdk === "OPENAI" ||
    sdk === "AZURE_OPENAI" ||
    sdk === "TYPESAFE" ||
    sdk === "GOOGLE_GENAI"
  );
}
