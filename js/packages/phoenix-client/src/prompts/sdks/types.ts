import { PromptVersion } from "../../types/prompts";

export type Variables = Record<string, { toString: () => string }>;

export type toSDKParamsBase = {
  prompt: PromptVersion;
  variables?: Variables;
};
