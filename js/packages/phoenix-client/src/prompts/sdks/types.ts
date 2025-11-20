import type { PromptVersion } from "../../types/prompts";

import type { SUPPORTED_SDKS } from "./constants";

/**
 * Variables to pass to the prompt
 *
 * Value can be anything that can be converted to a string
 */
export type Variables = Record<string, string | { toString: () => string }>;

/**
 * Base parameters for an SDK conversion function
 */
export type toSDKParamsBase<V extends Variables = Variables> = {
  /**
   * The Phoenix prompt to convert
   */
  prompt: PromptVersion;
  /**
   * The variables to use in the prompt
   */
  variables?: V;
};

/**
 * Supported SDK conversion targets for prompt conversion
 */
export type SupportedSDK = (typeof SUPPORTED_SDKS)[number];
