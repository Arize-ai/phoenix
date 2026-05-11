/**
 * Provider invocation adapter dispatch.
 *
 * The frontend talks to one adapter per provider family. This module owns the
 * "which adapter does this provider use?" routing so call sites stay
 * provider-agnostic.
 */

import type { ModelConfig } from "@phoenix/store/playground";
import type { CanonicalResponseFormat } from "@phoenix/store/playground/types";
import { assertUnreachable } from "@phoenix/typeUtils";

import type { PromptInvocationParametersReadableFragment$data } from "../__generated__/PromptInvocationParametersReadableFragment.graphql";
import type { PromptInvocationParametersInput } from "../__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";
import {
  getInvocationFamilyForProvider,
  InvocationFamily,
  type ParamSpec,
} from "../invocationParameterSpecs";
import { anthropicAdapter, type AnthropicConfig } from "./anthropicAdapter";
import { awsAdapter, type AwsConfig } from "./awsAdapter";
import { googleAdapter, type GoogleConfig } from "./googleAdapter";
import { openAIAdapter, type OpenAIConfig } from "./openaiAdapter";
import type { ProviderInvocationAdapter } from "./types";

export type ProviderInvocationConfig =
  | OpenAIConfig
  | AnthropicConfig
  | GoogleConfig
  | AwsConfig;

/**
 * Read-only prompt invocation parameters grouped by provider family. These
 * records are display/snippet projections of the stored GraphQL union, not
 * editable playground state, so provider adapters may preserve combinations the
 * run path would normalize away.
 */
export type PromptInvocationParameterDisplayRecord =
  | {
      family: typeof InvocationFamily.OPENAI;
      parameters: Record<string, unknown>;
    }
  | {
      family: typeof InvocationFamily.ANTHROPIC;
      parameters: Record<string, unknown>;
    }
  | {
      family: typeof InvocationFamily.GOOGLE_GENAI;
      parameters: Record<string, unknown>;
    }
  | {
      family: typeof InvocationFamily.AWS_BEDROCK;
      parameters: Record<string, unknown>;
    };

function getAdapterForFamily(
  family: InvocationFamily
): ProviderInvocationAdapter<ProviderInvocationConfig> {
  switch (family) {
    case InvocationFamily.OPENAI:
      return openAIAdapter as ProviderInvocationAdapter<ProviderInvocationConfig>;
    case InvocationFamily.ANTHROPIC:
      return anthropicAdapter as ProviderInvocationAdapter<ProviderInvocationConfig>;
    case InvocationFamily.GOOGLE_GENAI:
      return googleAdapter as ProviderInvocationAdapter<ProviderInvocationConfig>;
    case InvocationFamily.AWS_BEDROCK:
      return awsAdapter as ProviderInvocationAdapter<ProviderInvocationConfig>;
    default:
      return assertUnreachable(family);
  }
}

function getAdapterForProvider(
  provider: ModelProvider
): ProviderInvocationAdapter<ProviderInvocationConfig> {
  const family = getInvocationFamilyForProvider(provider);
  return getAdapterForFamily(family);
}

export function getDefaultInvocationConfig(
  provider: ModelProvider
): ProviderInvocationConfig {
  const adapter = getAdapterForProvider(provider);
  return adapter.normalize(adapter.getDefaultConfig());
}

/**
 * Coerce a raw saved config value into a canonical `ProviderInvocationConfig`.
 * Used by the store's hydration path for saved user preferences. This preserves
 * the saved canonical shape; fresh defaults come only from
 * `getDefaultInvocationConfig`.
 */
export function parseInvocationConfig(
  provider: ModelProvider,
  raw: unknown
): ProviderInvocationConfig {
  const adapter = getAdapterForProvider(provider);
  return adapter.normalize(adapter.parseConfig(raw));
}

/**
 * Canonical provider config → GraphQL prompt invocation input.
 */
export function invocationConfigToPromptInput(
  provider: ModelProvider,
  config: ProviderInvocationConfig
): PromptInvocationParametersInput {
  return getAdapterForProvider(provider).toPromptInput(config);
}

/**
 * GraphQL prompt invocation fragment data → canonical provider config. Prompt
 * load commits this config directly to playground state.
 */
export function promptInvocationDataToInvocationConfig(
  provider: ModelProvider,
  data: PromptInvocationParametersReadableFragment$data | null
): ProviderInvocationConfig {
  if (data == null) return getDefaultInvocationConfig(provider);
  const family = getInvocationFamilyForProvider(provider);
  const isMatchingTypename =
    (family === InvocationFamily.OPENAI &&
      data.__typename === "PromptOpenAIInvocationParameters") ||
    (family === InvocationFamily.ANTHROPIC &&
      data.__typename === "PromptAnthropicInvocationParameters") ||
    (family === InvocationFamily.GOOGLE_GENAI &&
      data.__typename === "PromptGoogleInvocationParameters") ||
    (family === InvocationFamily.AWS_BEDROCK &&
      data.__typename === "PromptAwsInvocationParameters");
  if (!isMatchingTypename) {
    return getDefaultInvocationConfig(provider);
  }
  return getAdapterForProvider(provider).fromPromptInvocationParameters(data);
}

/**
 * GraphQL prompt invocation fragment data → provider-family display record.
 * Dispatches by stored `__typename` instead of current model provider so the
 * display path faithfully represents what was persisted.
 */
export function promptInvocationDataToDisplayRecord(
  data: PromptInvocationParametersReadableFragment$data | null
): PromptInvocationParameterDisplayRecord | null {
  if (data == null) return null;
  let family: InvocationFamily;
  switch (data.__typename) {
    case "PromptOpenAIInvocationParameters":
      family = InvocationFamily.OPENAI;
      break;
    case "PromptAnthropicInvocationParameters":
      family = InvocationFamily.ANTHROPIC;
      break;
    case "PromptGoogleInvocationParameters":
      family = InvocationFamily.GOOGLE_GENAI;
      break;
    case "PromptAwsInvocationParameters":
      family = InvocationFamily.AWS_BEDROCK;
      break;
    case "%other":
      throw new Error(
        "Unsupported prompt invocation parameters typename: %other"
      );
    default:
      return assertUnreachable(data);
  }
  const adapter = getAdapterForFamily(family);
  return {
    family,
    parameters: adapter.fromPromptInvocationParametersForDisplay(data),
  } as PromptInvocationParameterDisplayRecord;
}

/**
 * Raw span `llm.invocation_parameters` → canonical provider config + promoted
 * playground fields (response format). Single entry point for span hydration
 * and provider-specific response-format promotion.
 */
export function spanInvocationToConfigAndPromoted(
  provider: ModelProvider,
  raw: unknown,
  options: { openaiApiType?: OpenAIApiType | null } = {}
): {
  invocationParameters: ProviderInvocationConfig;
  responseFormat: CanonicalResponseFormat | undefined;
} {
  const { config, promoted } = getAdapterForProvider(
    provider
  ).fromSpanInvocationParameters(raw, options);
  return {
    invocationParameters: config,
    responseFormat: promoted.responseFormat,
  };
}

/**
 * Canonical provider config → normalized canonical provider config. Store
 * mutations call this before committing config so field-rippling invalid
 * combinations cannot persist in playground state.
 */
export function normalizeInvocationConfig(
  provider: ModelProvider,
  config: ProviderInvocationConfig
): ProviderInvocationConfig {
  return getAdapterForProvider(provider).normalize(config);
}

/**
 * Read a single user-facing leaf from canonical config by spec name. Returns
 * the value the generic form widget expects (lowercased enum values, etc.) or
 * `undefined` when the leaf isn't reachable.
 */
export function readInvocationConfigField(
  provider: ModelProvider,
  config: ProviderInvocationConfig,
  name: string
): unknown {
  return getAdapterForProvider(provider).readField(config, name);
}

/**
 * Specs applicable to the current playground model. Visibility is provider
 * behavior, so the dispatcher only selects the adapter and the adapter projects
 * its static spec list into the fields the generic form should render now.
 */
export function getVisibleInvocationParameterSpecs(
  model: Pick<ModelConfig, "provider" | "openaiApiType">,
  config?: ProviderInvocationConfig
): readonly ParamSpec[] {
  return getAdapterForProvider(model.provider).getVisibleSpecs(config, {
    openaiApiType: model.openaiApiType,
  });
}

/**
 * Apply a single user-facing leaf write and return the new canonical config.
 * Passing `value === undefined` clears the leaf when possible. Cross-field
 * invariants are enforced inside the adapter.
 */
export function writeInvocationConfigField(
  provider: ModelProvider,
  config: ProviderInvocationConfig,
  name: string,
  value: unknown
): ProviderInvocationConfig {
  return getAdapterForProvider(provider).writeField(config, name, value);
}
