/**
 * Where a custom provider's decision requests go: one URL rule per decision
 * client. Mirrors `src/phoenix/server/decisions/endpoints.py`; both run the
 * cases in `tests/unit/server/decisions/decision_endpoint_cases.json`.
 *
 * OpenAI's Decisions API posts to `{base}/decisions` and System One to
 * `{base}/v1/systemone`. Chat base URLs usually end in `/v1`, which System One
 * adds itself, so its rule drops one trailing `/v1`.
 */
import type { GenerativeModelSDK } from "@phoenix/constants/generativeConstants";

export type DecisionSDK = "OPENAI" | "TYPESAFE";

export const DECISION_SDK_OPTIONS: ReadonlyArray<{
  id: DecisionSDK;
  label: string;
  description: string;
}> = [
  {
    id: "OPENAI",
    label: "OpenAI Decisions API",
    description: "POST {base URL}/decisions",
  },
  {
    id: "TYPESAFE",
    label: "System One",
    description: "POST {base URL}/v1/systemone",
  },
];

const DEFAULT_BASE_URLS: Record<DecisionSDK, string> = {
  OPENAI: "https://api.openai.com/v1",
  TYPESAFE: "https://api.typesafe.ai",
};

const PATHS: Record<DecisionSDK, string> = {
  OPENAI: "/decisions",
  TYPESAFE: "/v1/systemone",
};

function trimTrailingSlashes(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function removeV1Suffix(url: string): string {
  return url.endsWith("/v1") ? url.slice(0, -"/v1".length) : url;
}

/** The exact URL a decision request posts to. */
export function decisionEndpointUrl(
  decisionSdk: DecisionSDK,
  baseUrl: string
): string {
  const trimmed = trimTrailingSlashes(baseUrl);
  const clientBaseUrl =
    decisionSdk === "TYPESAFE" ? removeV1Suffix(trimmed) : trimmed;
  return clientBaseUrl + PATHS[decisionSdk];
}

/** A best guess at the decision base URL from the chat base URL. */
export function guessDecisionBaseUrl(
  decisionSdk: DecisionSDK,
  chatBaseUrl: string | null | undefined
): string {
  const chat = trimTrailingSlashes(chatBaseUrl ?? "");
  if (!chat) {
    return DEFAULT_BASE_URLS[decisionSdk];
  }
  return decisionSdk === "TYPESAFE" ? removeV1Suffix(chat) : chat;
}

/** The SDKs whose custom providers may serve decision models. */
export function sdkCanServeDecisions(sdk: GenerativeModelSDK): boolean {
  return sdk === "OPENAI" || sdk === "AZURE_OPENAI" || sdk === "TYPESAFE";
}

/** The chat base URL an Azure endpoint resolves to, as the server builds it. */
export function azureChatBaseUrl(endpoint: string | undefined): string | null {
  const trimmed = trimTrailingSlashes(endpoint ?? "");
  if (!trimmed) {
    return null;
  }
  return trimmed.endsWith("/openai/v1") ? trimmed : `${trimmed}/openai/v1`;
}
