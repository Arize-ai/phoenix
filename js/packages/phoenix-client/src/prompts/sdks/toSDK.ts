import invariant from "tiny-invariant";
import { toAI } from "./toAI";
import { toAnthropic } from "./toAnthropic";
import { toOpenAI } from "./toOpenAI";
import { SupportedSDK, Variables, toSDKParamsBase } from "./types";
import { assertUnreachable } from "../../utils/assertUnreachable";

/**
 * Parameters for an SDK conversion function
 *
 * @example
 * ```ts
 * const params: SDKParams<"openai"> = { ... }
 * toOpenAI(params)
 * ```
 */
export type SDKParams<T extends SupportedSDK> = Parameters<
  (typeof PROVIDER_TO_SDK)[T]
>[number] extends toSDKParamsBase
  ? Parameters<(typeof PROVIDER_TO_SDK)[T]>[number]
  : never;

/**
 * Map of SDK names to their corresponding conversion functions
 */
export const PROVIDER_TO_SDK = {
  openai: toOpenAI,
  anthropic: toAnthropic,
  ai: toAI,
};

/**
 * Get the conversion function for a specific SDK name
 */
const getTargetSDK = <T extends SupportedSDK>(sdk: T) => {
  switch (sdk) {
    case "openai":
      return PROVIDER_TO_SDK.openai;
    case "anthropic":
      return PROVIDER_TO_SDK.anthropic;
    case "ai":
      return PROVIDER_TO_SDK.ai;
    default:
      assertUnreachable(sdk);
  }
};

/**
 * Parameters specific to the toSDK function
 */
export type ToSDKParams<
  T extends SupportedSDK,
  V extends Variables = Variables,
> = {
  /**
   * String representing the SDK to convert to
   */
  sdk: T;
  /**
   * Optional variables to format the prompt with
   * Keys are the variable names, values are the variable values
   * The variable format is determined via prompt.template_format
   */
  variables?: V;
};

/**
 * Convert a Phoenix prompt to a specific SDK's parameters
 *
 * @example quickstart
 * ```ts
 * // Get a prompt from Phoenix, use it via openai sdk
 * const prompt = await getPrompt({ prompt: { name: "my-prompt" } });
 * const openaiParams = toSDK({ sdk: "openai", prompt });
 * const response = await openai.chat.completions.create(openaiParams);
 * ```
 *
 * @example type safety
 * ```ts
 * // Enforce variable types via Generic argument
 * const prompt = await getPrompt({ prompt: { name: "my-prompt" } });
 * const openaiParams = toSDK<"openai", { name: string }>({ sdk: "openai", prompt, variables: { name: "John" } });
 * ```
 *
 * @param params - The parameters to convert a prompt to an SDK's parameters
 * @returns The SDK's parameters
 */
export const toSDK = <T extends SupportedSDK, V extends Variables = Variables>({
  sdk: _sdk,
  ...rest
}: ToSDKParams<T, V> & SDKParams<T>) => {
  const sdk = getTargetSDK(_sdk);
  invariant(sdk, `No SDK found for provider ${_sdk}`);
  return sdk<V>(rest) as ReturnType<(typeof PROVIDER_TO_SDK)[T]>;
};
