import { graphql, readInlineData } from "relay-runtime";

import type { CreateDatasetLLMEvaluatorInput } from "@phoenix/components/dataset/__generated__/CreateLLMDatasetEvaluatorSlideover_createLLMEvaluatorMutation.graphql";
import type { UpdateDatasetLLMEvaluatorInput } from "@phoenix/components/dataset/__generated__/EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation.graphql";
import { utils_datasetExampleToEvaluatorInput_example$key } from "@phoenix/components/evaluators/__generated__/utils_datasetExampleToEvaluatorInput_example.graphql";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { getInstancePromptParamsFromStore } from "@phoenix/pages/playground/playgroundPromptUtils";
import {
  fromOpenAIToolDefinition,
  toOpenAIToolDefinition,
} from "@phoenix/schemas";
import {
  CategoricalChoiceToolType,
  CategoricalChoiceToolTypeSchema,
} from "@phoenix/schemas/phoenixToolTypeSchemas";
import { fromOpenAIToolChoice } from "@phoenix/schemas/toolChoiceSchemas";
import type {
  ClassificationEvaluatorAnnotationConfig,
  ContinuousEvaluatorAnnotationConfig,
  EvaluatorInputMapping,
  EvaluatorMappingSource,
  EvaluatorOptimizationDirection,
} from "@phoenix/types";

const createPromptVersionInput = ({
  playgroundStore,
  instanceId,
  description,
  outputConfig,
  includeExplanation,
}: {
  playgroundStore: ReturnType<typeof usePlaygroundStore>;
  instanceId: number;
  name: string;
  /**
   * The description of the evaluator.
   */
  description?: string;
  /**
   * The choice config of the evaluator.
   */
  outputConfig: ClassificationEvaluatorAnnotationConfig;
  /**
   * Whether to include an explanation for the evaluation score.
   */
  includeExplanation: boolean;
  /**
   * The input mapping of the evaluator.
   */
  inputMapping?: EvaluatorInputMapping;
  /**
   * The dataset ID to assign the evaluator to.
   */
  datasetId?: string;
}) => {
  const { promptInput, templateFormat, promptVersionId } =
    getInstancePromptParamsFromStore(instanceId, playgroundStore);
  const prunedPromptInput: CreateDatasetLLMEvaluatorInput["promptVersion"] = {
    ...promptInput,
    templateFormat,
    invocationParameters: {
      ...promptInput.invocationParameters,
      // add a required tool choice to the invocation parameters
      tool_choice: fromOpenAIToolChoice({
        toolChoice: "required",
        targetProvider: promptInput.modelProvider,
      }),
    },
    tools: [
      // replace whatever tools exist in the prompt with a categorical choice tool
      {
        definition: fromOpenAIToolDefinition({
          toolDefinition: CategoricalChoiceToolTypeSchema.parse({
            type: "function",
            function: {
              name: outputConfig.name,
              description,
              parameters: {
                type: "object",
                properties: {
                  label: {
                    type: "string",
                    enum: outputConfig.values.map((value) => value.label),
                    description: outputConfig.name,
                  },
                  ...(includeExplanation
                    ? {
                        explanation: {
                          type: "string",
                          description: `Explanation for choosing the label "${outputConfig.name}"`,
                        },
                      }
                    : {}),
                },
                required: [
                  "label",
                  ...(includeExplanation ? ["explanation"] : []),
                ],
              },
            },
          } satisfies CategoricalChoiceToolType),
          targetProvider: promptInput.modelProvider,
        }),
      },
    ],
    responseFormat: undefined,
  };

  return {
    prunedPromptInput,
    promptVersionId,
  };
};

export const updateLLMEvaluatorPayload = ({
  playgroundStore,
  instanceId,
  name: rawName,
  description: rawDescription,
  outputConfigs,
  datasetId,
  datasetEvaluatorId,
  inputMapping,
  includeExplanation,
}: {
  datasetEvaluatorId: string;
  datasetId: string;
  playgroundStore: ReturnType<typeof usePlaygroundStore>;
  instanceId: number;
  name: string;
  description: string;
  /**
   * Array of output configs. The first categorical config will be used
   * for the prompt tool definition.
   */
  outputConfigs: ClassificationEvaluatorAnnotationConfig[];
  inputMapping?: EvaluatorInputMapping;
  includeExplanation: boolean;
}): UpdateDatasetLLMEvaluatorInput => {
  const name = rawName.trim();
  const description = rawDescription.trim() || undefined;

  const configs = outputConfigs;
  const primaryConfig = configs[0];

  if (!primaryConfig) {
    throw new Error("At least one output config is required");
  }

  const { prunedPromptInput: promptVersion, promptVersionId } =
    createPromptVersionInput({
      playgroundStore,
      instanceId,
      name,
      description,
      outputConfig: primaryConfig,
      includeExplanation,
    });

  return {
    name,
    description,
    datasetEvaluatorId,
    datasetId,
    inputMapping: inputMapping,
    promptVersion,
    outputConfigs: configs.map((config) => ({
      categorical: {
        name: config.name,
        optimizationDirection: config.optimizationDirection,
        values: config.values.map((v) => ({
          label: v.label,
          score: v.score ?? null,
        })),
      },
    })),
    promptVersionId: promptVersionId ?? null,
  };
};
/**
 * Create a payload for the createLLMEvaluator or updateLLMEvaluator mutations.
 */
export const createLLMEvaluatorPayload = ({
  playgroundStore,
  instanceId,
  name: rawName,
  description: rawDescription,
  outputConfigs,
  datasetId,
  inputMapping,
  includeExplanation,
}: {
  /**
   * The playground store to use to get the instance prompt params.
   */
  playgroundStore: ReturnType<typeof usePlaygroundStore>;
  /**
   * The instance ID to use to get the instance prompt params.
   */
  instanceId: number;
  /**
   * The name of the evaluator.
   */
  name: string;
  /**
   * The description of the evaluator.
   */
  description: string;
  /**
   * Array of output configs. The first categorical config will be used
   * for the prompt tool definition.
   */
  outputConfigs: ClassificationEvaluatorAnnotationConfig[];
  /**
   * The input mapping of the evaluator.
   */
  inputMapping?: EvaluatorInputMapping;
  /**
   * Whether to include an explanation for the evaluation score.
   */
  includeExplanation: boolean;
  /**
   * The dataset ID to assign the evaluator to.
   */
  datasetId: string;
}): CreateDatasetLLMEvaluatorInput => {
  const name = rawName.trim();
  const description = rawDescription.trim() || undefined;

  const configs = outputConfigs;
  const primaryConfig = configs[0];

  if (!primaryConfig) {
    throw new Error("At least one output config is required");
  }

  const { prunedPromptInput: promptVersion, promptVersionId } =
    createPromptVersionInput({
      playgroundStore,
      instanceId,
      name,
      description,
      outputConfig: primaryConfig,
      includeExplanation,
    });

  return {
    name,
    description,
    datasetId,
    inputMapping: inputMapping,
    promptVersion,
    outputConfigs: configs.map((config) => ({
      categorical: {
        name: config.name,
        optimizationDirection: config.optimizationDirection,
        values: config.values.map((v) => ({
          label: v.label,
          score: v.score ?? null,
        })),
      },
    })),
    promptVersionId: promptVersionId ?? null,
  };
};

export type CreateLLMEvaluatorPayload = ReturnType<
  typeof createLLMEvaluatorPayload
>;

export const datasetExampleToEvaluatorInput = ({
  exampleRef,
  taskOutput = {},
}: {
  exampleRef: utils_datasetExampleToEvaluatorInput_example$key;
  taskOutput?: Record<string, unknown>;
}): EvaluatorMappingSource => {
  const example = readInlineData(
    graphql`
      fragment utils_datasetExampleToEvaluatorInput_example on DatasetExampleRevision
      @inline {
        input
        output
        metadata
      }
    `,
    exampleRef
  );
  return {
    input: example.input,
    output: taskOutput,
    reference: example.output,
    metadata: example.metadata,
  };
};

/**
 * Checks whether the prompt tools are configured to generate an explanation, looking for
 * the format generated by the createPromptVersionInput helper above.
 */
export const inferIncludeExplanationFromPrompt = (
  promptTools?: readonly { readonly definition: unknown }[]
): boolean => {
  if (!promptTools || promptTools.length === 0) {
    return false;
  }

  const tool = promptTools[0];
  if (!tool?.definition) {
    return false;
  }

  try {
    const definition =
      typeof tool.definition === "string"
        ? JSON.parse(tool.definition)
        : tool.definition;

    const toolDefinitionAsOpenAI = toOpenAIToolDefinition(definition);

    if (!toolDefinitionAsOpenAI) {
      return false;
    }

    return (
      toolDefinitionAsOpenAI.function.parameters?.properties?.explanation !==
      undefined
    );
  } catch {
    return false;
  }
};

/**
 * The type of output config override used in dataset evaluator mutations.
 */
export type OutputConfigOverride =
  | {
      categorical: {
        optimizationDirection: EvaluatorOptimizationDirection;
      };
    }
  | {
      continuous: {
        optimizationDirection: EvaluatorOptimizationDirection;
      };
    };

/**
 * The type of named output config override used in dataset evaluator mutations.
 * This matches the GraphQL NamedAnnotationConfigOverrideInput type.
 */
export type NamedOutputConfigOverride = {
  name: string;
  override: OutputConfigOverride;
};

/**
 * Union type for annotation configs (categorical or continuous).
 */
export type AnnotationConfig =
  | ClassificationEvaluatorAnnotationConfig
  | ContinuousEvaluatorAnnotationConfig;

/**
 * Build the output config override from a single annotation config.
 *
 * This determines whether the config is categorical (has "values" property)
 * or continuous and constructs the appropriate override structure.
 */
export const buildOutputConfigOverride = (
  outputConfig: AnnotationConfig | null | undefined
): OutputConfigOverride | undefined => {
  if (!outputConfig) {
    return undefined;
  }

  if ("values" in outputConfig) {
    // Categorical config
    return {
      categorical: {
        optimizationDirection: outputConfig.optimizationDirection,
      },
    };
  }

  // Continuous config
  return {
    continuous: {
      optimizationDirection: outputConfig.optimizationDirection,
    },
  };
};

/**
 * Build named output config overrides from the store's output config(s).
 *
 * This creates an array of NamedAnnotationConfigOverrideInput objects
 * that can be passed to the GraphQL mutations.
 *
 * Supports both a single config (for backward compatibility) and an array of configs.
 *
 * @param outputConfigOrConfigs - A single config, an array of configs, or null/undefined
 * @returns An array of NamedOutputConfigOverride objects
 */
export const buildNamedOutputConfigOverrides = (
  outputConfigOrConfigs:
    | AnnotationConfig
    | AnnotationConfig[]
    | null
    | undefined
): NamedOutputConfigOverride[] => {
  if (!outputConfigOrConfigs) {
    return [];
  }

  // Normalize to array
  const configs = Array.isArray(outputConfigOrConfigs)
    ? outputConfigOrConfigs
    : [outputConfigOrConfigs];

  return configs
    .map((config) => {
      const override = buildOutputConfigOverride(config);
      if (!override) {
        return null;
      }
      return {
        name: config.name,
        override,
      };
    })
    .filter((item): item is NamedOutputConfigOverride => item !== null);
};

/**
 * Build named output config overrides from a Map of overrides.
 *
 * This is useful when you have already processed overrides and stored them
 * in a Map keyed by config name.
 *
 * @param overrides - A Map where keys are config names and values are the override objects
 * @returns An array of NamedOutputConfigOverride objects, or undefined if the map is empty
 */
export const buildNamedOutputConfigOverridesFromMap = (
  overrides: Map<string, OutputConfigOverride>
): NamedOutputConfigOverride[] | undefined => {
  if (overrides.size === 0) {
    return undefined;
  }
  return Array.from(overrides.entries()).map(([name, override]) => ({
    name,
    override,
  }));
};

/**
 * Convert an annotation config to the GraphQL AnnotationConfigInput format.
 *
 * This function transforms frontend annotation configs into the format
 * expected by the GraphQL mutations.
 */
export const toAnnotationConfigInput = (
  config: AnnotationConfig
): {
  categorical?: {
    name: string;
    optimizationDirection: EvaluatorOptimizationDirection;
    values: { label: string; score: number | null }[];
  };
  continuous?: {
    name: string;
    optimizationDirection: EvaluatorOptimizationDirection;
    lowerBound?: number | null;
    upperBound?: number | null;
  };
} => {
  if ("values" in config) {
    // Categorical config
    return {
      categorical: {
        name: config.name,
        optimizationDirection: config.optimizationDirection,
        values: config.values.map((v) => ({
          label: v.label,
          score: v.score ?? null,
        })),
      },
    };
  }

  // Continuous config
  return {
    continuous: {
      name: config.name,
      optimizationDirection: config.optimizationDirection,
      lowerBound: config.lowerBound ?? null,
      upperBound: config.upperBound ?? null,
    },
  };
};

/**
 * Convert an array of annotation configs to the GraphQL outputConfigs format.
 *
 * @param configs - Array of annotation configs from the store
 * @returns Array of AnnotationConfigInput objects for GraphQL
 */
export const buildOutputConfigsInput = (
  configs: AnnotationConfig[]
): ReturnType<typeof toAnnotationConfigInput>[] => {
  return configs.map(toAnnotationConfigInput);
};

/**
 * Validates that all output config names are unique.
 *
 * @param configs - Array of annotation configs to validate
 * @returns An object with `isValid` boolean and `duplicateNames` set of duplicate names
 */
export const validateOutputConfigNames = (
  configs: AnnotationConfig[]
): { isValid: boolean; duplicateNames: Set<string>; emptyNames: number[] } => {
  const names = configs.map((config) => config.name);
  const seen = new Set<string>();
  const duplicateNames = new Set<string>();
  const emptyNames: number[] = [];

  names.forEach((name, index) => {
    if (!name || name.trim() === "") {
      emptyNames.push(index);
    } else if (seen.has(name)) {
      duplicateNames.add(name);
    }
    seen.add(name);
  });

  return {
    isValid: duplicateNames.size === 0 && emptyNames.length === 0,
    duplicateNames,
    emptyNames,
  };
};

/**
 * Returns an array of validation error messages for output configs.
 *
 * @param configs - Array of annotation configs to validate
 * @returns Array of error messages, or empty array if valid
 */
export const getOutputConfigValidationErrors = (
  configs: AnnotationConfig[]
): string[] => {
  const errors: string[] = [];
  const { duplicateNames, emptyNames } = validateOutputConfigNames(configs);

  if (emptyNames.length > 0) {
    errors.push(
      `Output config name${emptyNames.length > 1 ? "s" : ""} cannot be empty`
    );
  }

  if (duplicateNames.size > 0) {
    errors.push(
      `Duplicate output config names: ${Array.from(duplicateNames).join(", ")}`
    );
  }

  return errors;
};

export const formatBuiltinEvaluatorDisplayName = (name: string) => {
  return (
    name
      // convert camel case to snake case, but keep contiguous uppercase sequences together (e.g. "JSONDistance" -> "JSON_Distance")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2") // Handle boundary between acronym and normal word: JSONDistance -> JSON_Distance
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2") // Handle boundary between lower and upper: fooBar -> foo_Bar
      // replace spaces with underscores
      .replace(/\s+/g, "_")
      // trim leading and trailing underscores
      .replace(/^_+|_+$/g, "")
      // convert to lowercase
      .toLowerCase()
  );
};
