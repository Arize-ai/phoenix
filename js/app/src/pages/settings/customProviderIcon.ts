import invariant from "tiny-invariant";

import {
  type GenerativeModelSDK,
  SDK_TO_PROVIDER_MAP,
  STRING_TO_PROVIDER_MAP,
} from "@phoenix/constants/generativeConstants";

/**
 * The provider whose icon represents a custom provider: the one its provider
 * string names (e.g., "openai" → OPENAI), or else the one its SDK targets.
 */
export function resolveProviderIconKey({
  providerString,
  sdk,
}: {
  providerString: string;
  sdk: GenerativeModelSDK;
}): ModelProvider {
  const normalized = providerString.toLowerCase().replace(/[_-]/g, "");
  const matchedProvider = STRING_TO_PROVIDER_MAP[normalized];
  if (matchedProvider) {
    return matchedProvider;
  }
  const providerKey = SDK_TO_PROVIDER_MAP[sdk];
  invariant(providerKey, `Unknown SDK type: ${sdk}`);
  return providerKey;
}
