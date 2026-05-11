import type { CanonicalResponseFormat } from "@phoenix/store/playground/types";

import type { PromptInvocationParametersReadableFragment$data } from "../__generated__/PromptInvocationParametersReadableFragment.graphql";
import type { PromptInvocationParametersInput } from "../__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";
import type { ParamSpec } from "../invocationParameterSpecs";

/**
 * Extra model-level state an adapter may need when deciding which generic
 * parameter specs are visible. These values are intentionally not stored inside
 * provider invocation config because they affect routing or API mode, not the
 * invocation parameter payload itself.
 */
export type ProviderFormSpecContext = {
  openaiApiType?: OpenAIApiType | null;
};

/**
 * Provider-specific boundary for invocation parameters.
 *
 * The playground keeps provider configs in canonical frontend state, but each
 * provider has different defaults, UI visibility rules, wire shapes, and
 * cross-field invariants. Adapters keep those rules out of the generic form and
 * store code while preserving separate behavior for editable state, persisted
 * prompt display, and span hydration.
 */
export type ProviderInvocationAdapter<TConfig> = {
  /**
   * Fresh playground defaults for this provider. These are only for new
   * provider state; saved preferences and loaded prompts are parsed through the
   * read paths below so intentionally omitted values stay omitted.
   */
  getDefaultConfig(): TConfig;
  /**
   * Project this provider's static parameter metadata into the fields the
   * generic form should render for the current config/model context.
   */
  getVisibleSpecs(
    config: TConfig | undefined,
    context: ProviderFormSpecContext
  ): readonly ParamSpec[];
  /**
   * Coerce saved provider-shaped config into this provider's canonical frontend
   * shape. This parser is forgiving so corrupt or stale preference values do
   * not break playground load.
   */
  parseConfig(raw: unknown): TConfig;
  /**
   * Enforce invariants that should hold in editable/run state, such as removing
   * fields a provider rejects when another mode is active.
   */
  normalize(config: TConfig): TConfig;
  /**
   * Return submit-blocking errors for invariants that cannot be repaired
   * without changing user intent.
   */
  validateForSubmit(config: TConfig): readonly string[];
  /** Serialize canonical frontend state to the GraphQL prompt input union. */
  toPromptInput(config: TConfig): PromptInvocationParametersInput;
  /**
   * Hydrate editable playground state from stored prompt invocation parameters.
   * This path normalizes because loaded prompts become runnable/editable state.
   */
  fromPromptInvocationParameters(
    data: PromptInvocationParametersReadableFragment$data
  ): TConfig;
  /**
   * Project stored prompt invocation parameters for read-only display/snippets.
   * This path intentionally preserves persisted values, even combinations the
   * editable/run path would normalize away, so debugging views remain faithful.
   */
  fromPromptInvocationParametersForDisplay(
    data: PromptInvocationParametersReadableFragment$data
  ): Record<string, unknown>;
  /**
   * Hydrate editable playground state from span payloads and promote provider
   * fields that live outside invocation parameters in the playground model
   * (currently response format).
   */
  fromSpanInvocationParameters(
    raw: unknown,
    options?: { openaiApiType?: OpenAIApiType | null }
  ): {
    config: TConfig;
    promoted: { responseFormat?: CanonicalResponseFormat };
  };
  /**
   * Project a single user-facing leaf from the canonical config. Returns the
   * value the generic form widget should display (e.g. lowercased enum values),
   * or `undefined` when the leaf isn't reachable in the current config (e.g.
   * `thinkingBudgetTokens` when `thinking.type !== "enabled"`).
   *
   * Unknown field names return `undefined`.
   */
  readField(config: TConfig, name: string): unknown;
  /**
   * Apply a single user-facing leaf write to the canonical config and return a
   * new config. Cross-field invariants (e.g. flipping `thinkingType` clears or
   * rebuilds the discriminated `thinking` union) are enforced inside this
   * method. Passing `value === undefined` clears the leaf when possible.
   * Required leaves and leaves not reachable in the current config are silently
   * ignored. NaN numeric values are rejected.
   *
   * Unknown field names return the config unchanged.
   */
  writeField(config: TConfig, name: string, value: unknown): TConfig;
};
