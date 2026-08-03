import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";

import { getBrowserBuiltInModel } from "./browserModel";

/**
 * How AI search resolves the language model that translates natural language
 * into a filter expression.
 *
 * - `browser` runs entirely on-device via Browser AI — the browser's
 *   built-in model (Chrome / Edge Prompt API). No credentials and no
 *   network round trip.
 * - `provider` calls a configured LLM provider directly from the browser
 *   using the credentials stored locally (the same credentials the
 *   playground uses).
 */
export type AISearchModelConfig =
  | { kind: "browser" }
  | { kind: "provider"; provider: ModelProvider; modelName: string };

const BROWSER_MODEL_CONFIG: AISearchModelConfig = { kind: "browser" };

const DEFAULT_PROVIDER_MODEL_CONFIG: AISearchModelConfig = {
  kind: "provider",
  provider: DEFAULT_MODEL_PROVIDER,
  modelName: DEFAULT_MODEL_NAME,
};

/**
 * Resolves the persisted (possibly absent) model config to an effective
 * one — no config means Browser AI where the browser has a built-in model,
 * and the default hosted provider everywhere else (the picker doesn't offer
 * Browser AI there). The single home of that default, shared by every
 * surface that reads the preference. Returns stable objects so resolving on
 * every render stays identity-safe.
 */
export function resolveAISearchModelConfig(
  config: AISearchModelConfig | undefined
): AISearchModelConfig {
  if (config) {
    return config;
  }
  return getBrowserBuiltInModel() !== null
    ? BROWSER_MODEL_CONFIG
    : DEFAULT_PROVIDER_MODEL_CONFIG;
}

/**
 * A field an expression of the DSL can reference, with the prose description
 * shown to the model. Mirrors the shape of the typeahead completions so an
 * entity layer can derive one from the other.
 */
export type AISearchField = {
  name: string;
  description?: string;
};

/**
 * An example translation pair the model can generalize from — typically
 * derived from the same snippets that power the typeahead suggestions.
 */
export type AISearchExample = {
  description: string;
  expression: string;
};

/**
 * Everything the model needs to know about a filter DSL to translate a
 * natural-language request into it. Built by the entity layer (spans,
 * experiment runs, ...) — the AI layer itself knows nothing about any
 * specific DSL.
 */
export type AISearchDSL = {
  /**
   * The plural noun for the filtered entity, e.g. "spans". Used in prose:
   * "translate the request into a filter expression for spans".
   */
  noun: string;
  /**
   * The fields an expression can reference.
   */
  fields: AISearchField[];
  /**
   * Example request → expression pairs.
   */
  examples: AISearchExample[];
  /**
   * Additional dialect notes appended verbatim to the system prompt, e.g.
   * entity-specific idioms the fields and examples don't convey.
   */
  notes?: string[];
};
