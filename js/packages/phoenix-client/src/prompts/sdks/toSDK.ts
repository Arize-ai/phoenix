import invariant from "tiny-invariant";
import { toAI } from "./toAI";
import { toAnthropic } from "./toAnthropic";
import { toOpenAI } from "./toOpenAI";
import { Variables, toSDKParamsBase } from "./types";
import { assertUnreachable } from "../../utils/assertUnreachable";

const SUPPORTED_SDKS = ["openai", "anthropic", "ai"] as const;
type SupportedSDK = (typeof SUPPORTED_SDKS)[number];

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
>[0] extends toSDKParamsBase
  ? Parameters<(typeof PROVIDER_TO_SDK)[T]>[0]
  : never;

/**
 * Map of SDK names to their corresponding conversion functions
 */
const PROVIDER_TO_SDK = {
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
type ToSDKParams<T extends SupportedSDK> = {
  /**
   * String representing the SDK to convert to
   */
  sdk: T;
  /**
   * Optional variables to format the prompt with
   * Keys are the variable names, values are the variable values
   * The variable format is determined via prompt.template_format
   */
  variables?: Variables;
};

/**
 * Convert a Phoenix prompt to a specific SDK's parameters
 *
 * @example
 * ```ts
 * const prompt = await getPrompt({ prompt: { name: "my-prompt" } });
 * const openaiParams = toSDK({ sdk: "openai", prompt });
 * const response = await openai.chat.completions.create(openaiParams);
 * ```
 */
export const toSDK = <T extends SupportedSDK>({
  sdk: _sdk,
  ...rest
}: ToSDKParams<T> & SDKParams<T>) => {
  const sdk = getTargetSDK(_sdk);
  invariant(sdk, `No SDK found for provider ${_sdk}`);
  return sdk(rest) as ReturnType<(typeof PROVIDER_TO_SDK)[T]>;
};