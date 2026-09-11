/**
 * Map a judge model string to an AI SDK provider + model id.
 *
 * `provider:modelId` wins when present (e.g. `anthropic:claude-sonnet-4-5`).
 * Otherwise: `claude*` → anthropic, `gemini*` / `gemma*` → google, else openai.
 */
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";

export const DEFAULT_EVAL_MODEL = "gpt-4o-mini";

export const EVAL_MODEL_PROVIDERS = ["openai", "anthropic", "google"] as const;

export type EvalModelProvider = (typeof EVAL_MODEL_PROVIDERS)[number];

export type ParsedEvalModelRef = {
  provider: EvalModelProvider;
  modelId: string;
  raw: string;
};

function isEvalModelProvider(value: string): value is EvalModelProvider {
  return (EVAL_MODEL_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Parse `EVAL_MODEL` / `--models` tokens into provider + API model id.
 */
export function parseEvalModelRef(raw: string): ParsedEvalModelRef {
  const trimmed = raw.trim();
  if (trimmed === "") {
    throw new Error("EVAL_MODEL / --models token must be a non-empty model id");
  }
  const colonIndex = trimmed.indexOf(":");
  if (colonIndex >= 0) {
    const providerToken = trimmed.slice(0, colonIndex).trim().toLowerCase();
    const modelId = trimmed.slice(colonIndex + 1).trim();
    if (!isEvalModelProvider(providerToken)) {
      throw new Error(
        `Unknown eval model provider ${JSON.stringify(providerToken)}. Known: ${EVAL_MODEL_PROVIDERS.join(", ")}`
      );
    }
    if (modelId === "") {
      throw new Error(
        `EVAL_MODEL / --models token ${JSON.stringify(trimmed)} is missing a model id after ':'`
      );
    }
    return { provider: providerToken, modelId, raw: trimmed };
  }
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith("claude")) {
    return { provider: "anthropic", modelId: trimmed, raw: trimmed };
  }
  if (lowered.startsWith("gemini") || lowered.startsWith("gemma")) {
    return { provider: "google", modelId: trimmed, raw: trimmed };
  }
  return { provider: "openai", modelId: trimmed, raw: trimmed };
}

/**
 * Construct the AI SDK language model for a parsed (or raw) judge id.
 */
export function createEvalModel(raw: string) {
  const { provider, modelId } = parseEvalModelRef(raw);
  switch (provider) {
    case "anthropic":
      return anthropic(modelId);
    case "google":
      return google(modelId);
    case "openai":
      return openai(modelId);
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unhandled eval model provider: ${String(exhaustive)}`);
    }
  }
}
