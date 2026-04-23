import type { ModelConfig } from "@phoenix/store/playground";

import { canonicalizeInvocationParameters } from "./invocationParameterCanonicalization";
import type { ParamSpec } from "./invocationParameterSpecs";
import {
  getActiveSpecsForPlayground,
  getInvocationFamilyForProvider,
  invocationValueKeyForSpec,
  INVOCATION_PARAMETERS,
} from "./invocationParameterSpecs";
import {
  emptyPromptInvocationParametersRecord,
  type PromptInvocationParametersRecord,
  type RawPromptInvocationParametersRecord,
} from "./promptInvocationParameterCodecs";

// These types are no longer generated from GraphQL (since neither ChatCompletionInput
// nor ChatCompletionOverDatasetInput exposes invocationParameters as a list anymore).
// They are defined here as the canonical source for the frontend.
export type CanonicalParameterName =
  | "ANTHROPIC_EXTENDED_THINKING"
  | "MAX_COMPLETION_TOKENS"
  | "RANDOM_SEED"
  | "REASONING_EFFORT"
  | "RESPONSE_FORMAT"
  | "STOP_SEQUENCES"
  | "TEMPERATURE"
  | "TOP_P";

export type InvocationParameterInput = {
  canonicalName?: CanonicalParameterName | null;
  invocationName: string;
  valueBool?: boolean | null;
  valueBoolean?: boolean | null;
  valueFloat?: number | null;
  valueInt?: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  valueJson?: any | null;
  valueString?: string | null;
  valueStringList?: ReadonlyArray<string> | null;
};

export type ChatCompletionMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";

function paramName(
  p: InvocationParameterInput | ParamSpec
): string | undefined {
  if ("invocationName" in p && p.invocationName) {
    return p.invocationName;
  }
  return "name" in p && p.name ? p.name : undefined;
}

/**
 * Check if two invocation parameters are equal by comparing their invocation name and canonical name
 */
export function areInvocationParamsEqual(
  paramA: InvocationParameterInput | ParamSpec,
  paramB: InvocationParameterInput | ParamSpec
) {
  const nameA = paramName(paramA);
  const nameB = paramName(paramB);
  return (
    (nameA != null && nameA === nameB) ||
    // loose null comparison to catch undefined and null
    (paramA.canonicalName != null &&
      paramB.canonicalName != null &&
      paramA.canonicalName === paramB.canonicalName)
  );
}

/**
 * Keep only invocation parameter inputs that match a static {@link ParamSpec} name
 * (frontend-owned spec table).
 */
export const constrainInvocationParameterInputsToSpecs = (
  invocationParameterInputs: InvocationParameterInput[],
  specs: readonly ParamSpec[]
): InvocationParameterInput[] => {
  const names = new Set(specs.map((s) => s.name));
  return invocationParameterInputs.filter(
    (ip) => ip.invocationName != null && names.has(ip.invocationName)
  );
};

/**
 * Converts a raw invocation-parameters record (e.g. from the schema or
 * GraphQL reader) into form-store {@link InvocationParameterInput} rows.
 * Canonicalizes internally so the rows only carry canonical keys, and
 * iterates `record.parameters` (not the outer wrapper) so the `family`
 * discriminator can never leak into a row.
 */
export function objectToInvocationParameters(
  invocationParameters: RawPromptInvocationParametersRecord,
  options?: {
    openaiApiType?: OpenAIApiType | null;
  }
): InvocationParameterInput[] {
  const canonical = canonicalizeInvocationParameters(invocationParameters, {
    openaiApiType: options?.openaiApiType ?? null,
  });
  const specs = INVOCATION_PARAMETERS[canonical.family];
  const specByName = Object.fromEntries(specs.map((s) => [s.name, s]));
  return Object.entries(canonical.parameters).flatMap(([key, value]) => {
    const spec = specByName[key];
    if (!spec) {
      return [{ invocationName: key, valueJson: value }];
    }
    const vk = invocationValueKeyForSpec(spec);
    return [
      {
        invocationName: spec.name,
        canonicalName: spec.canonicalName,
        [vk]: value,
      } as InvocationParameterInput,
    ];
  });
}

/**
 * Merge defaults from {@link ParamSpec} entries (replaces GraphQL-sourced defaults).
 */
export function mergeInvocationParametersWithSpecDefaults(
  invocationParameters: InvocationParameterInput[],
  specs: readonly ParamSpec[]
): InvocationParameterInput[] {
  const current = new Map(
    invocationParameters.map((p) => [p.invocationName, p])
  );
  for (const spec of specs) {
    if (!("defaultValue" in spec) || spec.defaultValue === undefined) {
      continue;
    }
    const existing = current.get(spec.name);
    const field = invocationValueKeyForSpec(spec);
    if (
      existing?.[field] != null ||
      existing?.valueJson != null ||
      existing?.valueStringList != null
    ) {
      continue;
    }
    current.set(spec.name, {
      invocationName: spec.name,
      canonicalName: spec.canonicalName,
      [field]: spec.defaultValue,
    } as InvocationParameterInput);
  }
  return Array.from(current.values());
}

function extractInvocationParameterInputValue(
  p: InvocationParameterInput
): unknown {
  return (
    p.valueFloat ??
    p.valueInt ??
    p.valueBool ??
    p.valueBoolean ??
    p.valueString ??
    p.valueJson ??
    p.valueStringList ??
    null
  );
}

/**
 * Collapse form-store `InvocationParameterInput[]` rows into a dict keyed by
 * spec `name` — the inverse of `objectToInvocationParameters`. Output shape
 * matches `PromptInvocationParametersRecord` from `promptInvocationParameterCodecs`.
 */
export function invocationParametersToObject(
  invocationParameters: InvocationParameterInput[],
  model: Pick<ModelConfig, "provider" | "openaiApiType">
): PromptInvocationParametersRecord {
  const family = getInvocationFamilyForProvider(model.provider);
  const specs = getActiveSpecsForPlayground(model);
  const specByName = new Map(specs.map((s) => [s.name, s]));
  const record = emptyPromptInvocationParametersRecord(family);
  const parameters = record.parameters as Record<string, unknown>;
  for (const curr of invocationParameters) {
    if (!curr.invocationName) {
      continue;
    }
    const spec = specByName.get(curr.invocationName);
    if (spec) {
      const field = invocationValueKeyForSpec(spec);
      const v = curr[field];
      if (v !== null && v !== undefined) {
        parameters[curr.invocationName] = v;
      }
    } else {
      const v = extractInvocationParameterInputValue(curr);
      if (v !== null && v !== undefined) {
        parameters[curr.invocationName] = v;
      }
    }
  }
  return record;
}
