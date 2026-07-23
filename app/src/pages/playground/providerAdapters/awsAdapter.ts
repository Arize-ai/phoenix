/**
 * AWS Bedrock provider invocation adapter.
 *
 * Owns the `inferenceConfig.*` → flat top-level fold and the AWS branch of
 * response-format promotion from span attributes (the nested
 * `outputConfig.textFormat.structure.jsonSchema` shape, including the
 * JSON-string-encoded schema variant).
 */

import { z } from "zod";

import type { CanonicalResponseFormat } from "@phoenix/store/playground/types";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

import type { PromptInvocationParametersReadableFragment$data } from "../__generated__/PromptInvocationParametersReadableFragment.graphql";
import type {
  PromptAwsInvocationParametersInput,
  PromptInvocationParametersInput,
} from "../__generated__/UpsertPromptFromTemplateDialogCreateMutation.graphql";
import { AWS_INVOCATION_PARAMETERS } from "../invocationParameterSpecs";
import type { ProviderInvocationAdapter } from "./types";

// ---------- canonical types --------------------------------------------------

export type AwsConfig = {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
};

export type AwsPromotedPlaygroundFields = {
  responseFormat?: CanonicalResponseFormat;
};

// ---------- parseConfig ------------------------------------------------------

export function getDefaultAwsConfig(): AwsConfig {
  return {
    maxTokens: 1024,
    temperature: 1,
  };
}

export function getVisibleAwsSpecs() {
  return AWS_INVOCATION_PARAMETERS;
}

const canonicalConfigSchema = z.looseObject({
  maxTokens: z.number().optional().catch(undefined),
  temperature: z.number().optional().catch(undefined),
  topP: z.number().optional().catch(undefined),
  stopSequences: z.array(z.string()).optional().catch(undefined),
});

export function parseAwsConfig(raw: unknown): AwsConfig {
  const parsed = canonicalConfigSchema.safeParse(raw);
  const input = parsed.success ? parsed.data : {};
  const config: AwsConfig = {};
  if (input.maxTokens !== undefined) config.maxTokens = input.maxTokens;
  if (input.temperature !== undefined) config.temperature = input.temperature;
  if (input.topP !== undefined) config.topP = input.topP;
  if (input.stopSequences !== undefined)
    config.stopSequences = [...input.stopSequences];
  return config;
}

// ---------- normalize --------------------------------------------------------

export function normalizeAwsConfig(config: AwsConfig): AwsConfig {
  return config;
}

// ---------- validateForSubmit -----------------------------------------------

export function validateAwsConfigForSubmit(
  _config: AwsConfig
): readonly string[] {
  return [];
}

// ---------- toPromptInput ----------------------------------------------------

export function awsConfigToPromptInput(
  config: AwsConfig
): PromptInvocationParametersInput {
  const normalized = normalizeAwsConfig(config);
  const aws: PromptAwsInvocationParametersInput = {};
  if (normalized.maxTokens !== undefined) aws.maxTokens = normalized.maxTokens;
  if (normalized.temperature !== undefined)
    aws.temperature = normalized.temperature;
  if (normalized.topP !== undefined) aws.topP = normalized.topP;
  if (normalized.stopSequences !== undefined)
    aws.stopSequences = normalized.stopSequences;
  return { aws };
}

// ---------- fromPromptInvocationParameters -----------------------------------

export function awsConfigFromPromptInvocationParameters(
  data: PromptInvocationParametersReadableFragment$data
): AwsConfig {
  if (data.__typename !== "PromptAwsInvocationParameters") {
    throw new Error(
      `awsAdapter.fromPromptInvocationParameters called with non-AWS typename: ${data.__typename}`
    );
  }
  const config: AwsConfig = {};
  if (data.awsMaxTokens != null) config.maxTokens = data.awsMaxTokens;
  if (data.temperature != null) config.temperature = data.temperature;
  if (data.topP != null) config.topP = data.topP;
  if (data.stopSequences != null)
    config.stopSequences = [...data.stopSequences];
  return normalizeAwsConfig(config);
}

export function awsConfigFromPromptInvocationParametersForDisplay(
  data: PromptInvocationParametersReadableFragment$data
): Record<string, unknown> {
  if (data.__typename !== "PromptAwsInvocationParameters") {
    throw new Error(
      `awsAdapter.fromPromptInvocationParametersForDisplay called with non-AWS typename: ${data.__typename}`
    );
  }
  const parameters: Record<string, unknown> = {};
  if (data.awsMaxTokens != null) parameters.maxTokens = data.awsMaxTokens;
  if (data.temperature != null) parameters.temperature = data.temperature;
  if (data.topP != null) parameters.topP = data.topP;
  if (data.stopSequences != null)
    parameters.stopSequences = [...data.stopSequences];
  return parameters;
}

// ---------- fromSpanInvocationParameters -------------------------------------

const inferenceConfigSchema = z
  .object({
    maxTokens: z.number().optional().catch(undefined),
    temperature: z.number().optional().catch(undefined),
    topP: z.number().optional().catch(undefined),
    stopSequences: z.array(z.string()).optional().catch(undefined),
  })
  .optional()
  .catch(undefined);

const outputConfigJsonSchemaSchema = z
  .object({
    schema: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
    name: z.string().optional(),
    description: z.string().optional(),
  })
  .optional()
  .catch(undefined);

const outputConfigSchema = z
  .object({
    textFormat: z
      .object({
        structure: z
          .object({
            jsonSchema: outputConfigJsonSchemaSchema,
          })
          .optional()
          .catch(undefined),
      })
      .optional()
      .catch(undefined),
  })
  .optional()
  .catch(undefined);

const spanConfigSchema = z.looseObject({
  maxTokens: z.number().optional().catch(undefined),
  temperature: z.number().optional().catch(undefined),
  topP: z.number().optional().catch(undefined),
  stopSequences: z.array(z.string()).optional().catch(undefined),
  inferenceConfig: inferenceConfigSchema,
  outputConfig: outputConfigSchema,
});

export function awsConfigFromSpanInvocationParameters(raw: unknown): {
  config: AwsConfig;
  promoted: AwsPromotedPlaygroundFields;
} {
  const parsed = spanConfigSchema.safeParse(raw);
  const input = parsed.success ? parsed.data : {};
  const config: AwsConfig = {};
  // Top-level keys are the flatter, provider-neutral shape Phoenix prefers.
  // Nested `inferenceConfig` values fill gaps when spans carry only the native
  // Bedrock request shape.
  if (input.maxTokens !== undefined) config.maxTokens = input.maxTokens;
  else if (input.inferenceConfig?.maxTokens !== undefined)
    config.maxTokens = input.inferenceConfig.maxTokens;
  if (input.temperature !== undefined) config.temperature = input.temperature;
  else if (input.inferenceConfig?.temperature !== undefined)
    config.temperature = input.inferenceConfig.temperature;
  if (input.topP !== undefined) config.topP = input.topP;
  else if (input.inferenceConfig?.topP !== undefined)
    config.topP = input.inferenceConfig.topP;
  if (input.stopSequences !== undefined)
    config.stopSequences = [...input.stopSequences];
  else if (input.inferenceConfig?.stopSequences !== undefined)
    config.stopSequences = [...input.inferenceConfig.stopSequences];

  const promoted: AwsPromotedPlaygroundFields = {};
  const js = input.outputConfig?.textFormat?.structure?.jsonSchema;
  if (js?.schema != null) {
    let schemaObj: object | null = null;
    if (typeof js.schema === "string") {
      const { json } = safelyParseJSON(js.schema);
      const parsedSchema: unknown = json;
      if (
        parsedSchema != null &&
        typeof parsedSchema === "object" &&
        !Array.isArray(parsedSchema)
      ) {
        schemaObj = parsedSchema;
      }
    } else if (typeof js.schema === "object" && !Array.isArray(js.schema)) {
      schemaObj = js.schema;
    }
    if (schemaObj != null) {
      const jsonSchema: CanonicalResponseFormat["jsonSchema"] = {
        name: typeof js.name === "string" ? js.name : "response",
        schema: schemaObj,
      };
      if (typeof js.description === "string")
        jsonSchema.description = js.description;
      promoted.responseFormat = { type: "json_schema", jsonSchema };
    }
  }

  return { config: normalizeAwsConfig(config), promoted };
}

// ---------- field-keyed read/write ------------------------------------------

export function awsReadField(config: AwsConfig, name: string): unknown {
  switch (name) {
    case "maxTokens":
      return config.maxTokens;
    case "temperature":
      return config.temperature;
    case "topP":
      return config.topP;
    case "stopSequences":
      return config.stopSequences;
    default:
      return undefined;
  }
}

export function awsWriteField(
  config: AwsConfig,
  name: string,
  value: unknown
): AwsConfig {
  switch (name) {
    case "maxTokens":
    case "temperature":
    case "topP": {
      if (value === undefined) {
        const next = { ...config };
        delete next[name];
        return normalizeAwsConfig(next);
      }
      if (typeof value !== "number" || Number.isNaN(value)) return config;
      return normalizeAwsConfig({ ...config, [name]: value });
    }
    case "stopSequences": {
      if (value === undefined) {
        const next = { ...config };
        delete next.stopSequences;
        return normalizeAwsConfig(next);
      }
      if (!Array.isArray(value)) return config;
      return normalizeAwsConfig({
        ...config,
        stopSequences: value.map(String),
      });
    }
    default:
      return config;
  }
}

export const awsAdapter: ProviderInvocationAdapter<AwsConfig> = {
  getDefaultConfig: getDefaultAwsConfig,
  getVisibleSpecs: getVisibleAwsSpecs,
  parseConfig: parseAwsConfig,
  normalize: normalizeAwsConfig,
  validateForSubmit: validateAwsConfigForSubmit,
  toPromptInput: awsConfigToPromptInput,
  fromPromptInvocationParameters: awsConfigFromPromptInvocationParameters,
  fromPromptInvocationParametersForDisplay:
    awsConfigFromPromptInvocationParametersForDisplay,
  fromSpanInvocationParameters: (raw) =>
    awsConfigFromSpanInvocationParameters(raw),
  readField: awsReadField,
  writeField: awsWriteField,
};
