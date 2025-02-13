import { PromptModelProvider } from "../../types/prompts";

export const SUPPORTED_SDKS = ["openai", "anthropic", "ai"] as const;

export const SUPPORTED_SDK_TO_PROMPT_MODEL_PROVIDER = {
  openai: "OPENAI",
  anthropic: "ANTHROPIC",
} satisfies Partial<
  Record<(typeof SUPPORTED_SDKS)[number], PromptModelProvider>
>;
