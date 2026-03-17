import type { InvocationParameter } from "../../components/playground/model/InvocationParametersFormFields";

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

/**
 * Check if two invocation parameters are equal by comparing their invocation name and canonical name
 */
export function areInvocationParamsEqual(
  paramA: InvocationParameter | InvocationParameterInput,
  paramB: InvocationParameter | InvocationParameterInput
) {
  return (
    paramA.invocationName === paramB.invocationName ||
    // loose null comparison to catch undefined and null
    (paramA.canonicalName != null &&
      paramB.canonicalName != null &&
      paramA.canonicalName === paramB.canonicalName)
  );
}

/**
 * Filter out parameters that are not supported by a model's invocation parameter schema definitions.
 */
export const constrainInvocationParameterInputsToDefinition = (
  invocationParameterInputs: InvocationParameterInput[],
  definitions: InvocationParameter[]
) => {
  return invocationParameterInputs
    .filter((ip) =>
      // An input should be kept if it matches an invocation name in the definitions
      // or if it has a canonical name that matches a canonical name in the definitions.
      definitions.some((mp) => areInvocationParamsEqual(mp, ip))
    )
    .map((ip) => ({
      // Transform the invocationName to match the new name from the incoming
      // modelSupportedInvocationParameters.
      ...ip,
      invocationName:
        definitions.find((mp) => areInvocationParamsEqual(mp, ip))
          ?.invocationName ?? ip.invocationName,
    }));
};

/**
 * Converts a string from snake_case to camelCase.
 */
export const toCamelCase = (str: string) =>
  str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());

/**
 * Extracts the default value for the invocation parameter definition
 * And the key name that should be used in the invocation parameter input if we need to make a new one
 *
 * This logic is necessary because the default value is mapped to different key name based on its type
 * within the InvocationParameterInput queries in the playground e.g. floatDefaultValue or stringListDefaultValue
 */
const getInvocationParamDefaultValue = (
  param: InvocationParameter
): unknown => {
  for (const [key, value] of Object.entries(param)) {
    if (key.endsWith("DefaultValue") && value != null) {
      return param[key as keyof InvocationParameter];
    }
  }
  return undefined;
};

/**
 * Merges the current invocation parameters with the default values for the supported invocation parameters,
 * only adding values for invocation parameters that don't already have a value
 */
export function mergeInvocationParametersWithDefaults(
  invocationParameters: InvocationParameterInput[],
  supportedInvocationParameters: InvocationParameter[]
) {
  // Convert the current invocation parameters to a map for quick lookup
  const currentInvocationParametersMap = new Map(
    invocationParameters.map((param) => [param.invocationName, param])
  );
  supportedInvocationParameters.forEach((param) => {
    const paramKeyName = param.invocationName;
    // Extract the default value for the invocation parameter definition
    // And the key name that should be used in the invocation parameter input if we need to make a new one
    const defaultValue = getInvocationParamDefaultValue(param);
    // Convert the invocation input field to a key name that can be used in the invocation parameter input
    const invocationInputFieldKeyName = toCamelCase(
      param.invocationInputField || ""
    ) as keyof InvocationParameterInput;
    // Skip if we don't have required fields
    // or, if the current invocation parameter map already has a value for the key
    // so that we don't overwrite a user provided value, or a value saved to preferences
    if (
      !param.invocationName ||
      !param.invocationInputField ||
      !paramKeyName ||
      defaultValue == null ||
      currentInvocationParametersMap.get(paramKeyName)?.[
        invocationInputFieldKeyName
      ] != null
    ) {
      return;
    }
    // Create the new invocation parameter input, using the default value for the parameter
    const newInvocationParameter: InvocationParameterInput = {
      canonicalName: param.canonicalName,
      invocationName: param.invocationName,
      [invocationInputFieldKeyName]: defaultValue,
    };

    // Add the new invocation parameter input to the map
    currentInvocationParametersMap.set(paramKeyName, newInvocationParameter);
  });

  // Return the new invocation parameter inputs as an array
  return Array.from(currentInvocationParametersMap.values());
}
