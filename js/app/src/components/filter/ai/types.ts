import { getBrowserBuiltInModel } from "@phoenix/components/generative/browserAI";
import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";

/**
 * A model served through the Phoenix server's OpenAI-compatible
 * `/v1/chat/completions` proxy, which resolves provider credentials on the
 * server (secret store first, environment second) — no keys in the browser.
 * Either a built-in provider or a stored custom provider record.
 */
export type AIQueryServerModelConfig =
  | {
      kind: "server";
      source: "builtin";
      provider: ModelProvider;
      modelName: string;
    }
  | {
      kind: "server";
      source: "custom";
      providerId: string;
      providerName: string;
      modelName: string;
    };

/**
 * How AI query resolves the language model that translates natural language
 * into a filter expression.
 *
 * - `browser` runs entirely on-device via Browser AI — the browser's
 *   built-in model (Chrome / Edge Prompt API). No credentials and no
 *   network round trip.
 * - `server` calls the chosen provider through the Phoenix server's
 *   OpenAI-compatible proxy using credentials configured on the server.
 */
export type AIQueryModelConfig = { kind: "browser" } | AIQueryServerModelConfig;

/**
 * The retired persisted shape that called providers directly from the
 * browser with locally held API keys, before provider calls were
 * consolidated onto the server proxy. Still accepted on read so an
 * existing preference keeps working; normalized to the server config.
 */
type LegacyProviderModelConfig = {
  kind: "provider";
  provider: ModelProvider;
  modelName: string;
};

const BROWSER_MODEL_CONFIG: AIQueryModelConfig = { kind: "browser" };

const DEFAULT_SERVER_MODEL_CONFIG: AIQueryModelConfig = {
  kind: "server",
  source: "builtin",
  provider: DEFAULT_MODEL_PROVIDER,
  modelName: DEFAULT_MODEL_NAME,
};

/**
 * Resolves the persisted (possibly absent) model config to an effective
 * one — no config means Browser AI where the browser has a built-in model,
 * and the default provider on the server proxy everywhere else (the picker
 * doesn't offer Browser AI there). Legacy browser-direct provider configs
 * map to the same provider on the server proxy. The single home of those
 * defaults, shared by every surface that reads the preference. No caller
 * puts the result in a dependency array, so the converted legacy object
 * needs no identity stability.
 */
export function resolveAIQueryModelConfig(
  config: AIQueryModelConfig | LegacyProviderModelConfig | undefined
): AIQueryModelConfig {
  if (config == null) {
    return getBrowserBuiltInModel() !== null
      ? BROWSER_MODEL_CONFIG
      : DEFAULT_SERVER_MODEL_CONFIG;
  }
  if (config.kind === "provider") {
    return {
      kind: "server",
      source: "builtin",
      provider: config.provider,
      modelName: config.modelName,
    };
  }
  return config;
}

/**
 * A field an expression of the DSL can reference, with the prose description
 * shown to the model. Mirrors the shape of the typeahead completions so an
 * entity layer can derive one from the other.
 */
export type AIQueryField = {
  name: string;
  description?: string;
};

/**
 * An example translation pair the model can generalize from — typically
 * derived from the same snippets that power the typeahead suggestions.
 */
export type AIQueryExample = {
  description: string;
  expression: string;
};

/**
 * Everything the model needs to know about a filter DSL to translate a
 * natural-language request into it. Built by the entity layer (spans,
 * experiment runs, ...) — the AI layer itself knows nothing about any
 * specific DSL.
 */
export type AIQueryDSL = {
  /**
   * The plural noun for the filtered entity, e.g. "spans". Used in prose:
   * "translate the request into a filter expression for spans".
   */
  noun: string;
  /**
   * The fields an expression can reference.
   */
  fields: AIQueryField[];
  /**
   * Example request → expression pairs.
   */
  examples: AIQueryExample[];
  /**
   * Additional dialect notes appended verbatim to the system prompt, e.g.
   * entity-specific idioms the fields and examples don't convey.
   */
  notes?: string[];
};
