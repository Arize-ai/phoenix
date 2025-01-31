import { PromptVersion } from "../../types/prompts";

/**
 * Variables to pass to the prompt
 *
 * Value can be anything that can be converted to a string
 */
export type Variables = Record<string, string | { toString: () => string }>;

/**
 * Base parameters for an SDK conversion function
 */
export type toSDKParamsBase = {
  prompt: PromptVersion;
  variables?: Variables;
};
