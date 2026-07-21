import { graphql, readInlineData } from "relay-runtime";

import type { CreateDatasetLLMEvaluatorInput } from "@phoenix/components/dataset/__generated__/CreateLLMDatasetEvaluatorSlideover_createLLMEvaluatorMutation.graphql";
import type { UpdateDatasetLLMEvaluatorInput } from "@phoenix/components/dataset/__generated__/EditLLMDatasetEvaluatorSlideover_updateLLMEvaluatorMutation.graphql";
import type { utils_datasetExampleToEvaluatorInput_example$key } from "@phoenix/components/evaluators/__generated__/utils_datasetExampleToEvaluatorInput_example.graphql";
import type { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { getInstancePromptParamsFromStore } from "@phoenix/pages/playground/playgroundPromptUtils";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import type {
  ClassificationEvaluatorAnnotationConfig,
  ContinuousEvaluatorAnnotationConfig,
  EvaluatorInputMapping,
  EvaluatorMappingSource,
  EvaluatorOptimizationDirection,
  FreeformEvaluatorAnnotationConfig,
} from "@phoenix/types";
import { isObject } from "@phoenix/typeUtils";

// Single source of judge tools, shared by Save and preview so the two can't diverge.
export const buildJudgeToolFunctions = ({
  outputConfigs,
  includeExplanation,
  description,
}: {
  outputConfigs: AnnotationConfig[];
  includeExplanation: boolean;
  description?: string;
}) => {
  const categoricalConfigs = outputConfigs.filter(
    (c): c is ClassificationEvaluatorAnnotationConfig => "values" in c
  );
  return categoricalConfigs.map((config) => ({
    function: {
      name: config.name,
      description: description ?? null,
      parameters: {
        type: "object",
        properties: {
          label: {
            type: "string",
            enum: config.values.map((value) => value.label),
            description: config.name,
          },
          ...(includeExplanation
            ? {
                explanation: {
                  type: "string",
                  description: `Explanation for choosing the label "${config.name}"`,
                },
              }
            : {}),
        },
        required: ["label", ...(includeExplanation ? ["explanation"] : [])],
      },
      strict: null,
    },
  }));
};

const createPromptVersionInput = ({
  playgroundStore,
  instanceId,
  description,
  outputConfigs,
  includeExplanation,
}: {
  playgroundStore: ReturnType<typeof usePlaygroundStore>;
  instanceId: number;
  /**
   * The description of the evaluator.
   */
  description?: string;
  /**
   * The output configs of the evaluator. Only categorical configs generate tools.
   */
  outputConfigs: AnnotationConfig[];
  /**
   * Whether to include an explanation for the evaluation score.
   */
  includeExplanation: boolean;
}) => {
  const { promptInput, promptVersionId } = getInstancePromptParamsFromStore(
    instanceId,
    playgroundStore
  );

  const toolFunctions = buildJudgeToolFunctions({
    outputConfigs,
    includeExplanation,
    description,
  });

  const prunedPromptInput: CreateDatasetLLMEvaluatorInput["promptVersion"] = {
    ...promptInput,
    invocationParameters: promptInput.invocationParameters,
    tools: toolFunctions.length
      ? {
          tools: toolFunctions,
          toolChoice: { oneOrMore: true },
        }
      : null,
    responseFormat: null,
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
   * The output configs for the evaluator. Used for prompt tool definitions and GraphQL payload.
   */
  outputConfigs: AnnotationConfig[];
  inputMapping?: EvaluatorInputMapping;
  includeExplanation: boolean;
}): UpdateDatasetLLMEvaluatorInput => {
  const name = rawName.trim();
  const description = rawDescription.trim() || undefined;

  const { prunedPromptInput: promptVersion, promptVersionId } =
    createPromptVersionInput({
      playgroundStore,
      instanceId,
      description,
      outputConfigs,
      includeExplanation,
    });

  return {
    name,
    description,
    datasetEvaluatorId,
    datasetId,
    inputMapping: inputMapping,
    promptVersion,
    outputConfigs: buildOutputConfigsInput(outputConfigs),
    promptVersionId: promptVersionId ?? null,
  };
};

/**
 * Create the evaluator definition shared by dataset and project LLM
 * evaluator mutations.
 */
export const createLLMEvaluatorDefinitionPayload = ({
  playgroundStore,
  instanceId,
  name: rawName,
  description: rawDescription,
  outputConfigs,
  includeExplanation,
}: {
  playgroundStore: ReturnType<typeof usePlaygroundStore>;
  instanceId: number;
  name: string;
  description: string;
  outputConfigs: AnnotationConfig[];
  includeExplanation: boolean;
}) => {
  const name = rawName.trim();
  const description = rawDescription.trim() || undefined;

  const { prunedPromptInput: promptVersion, promptVersionId } =
    createPromptVersionInput({
      playgroundStore,
      instanceId,
      description,
      outputConfigs,
      includeExplanation,
    });

  return {
    name,
    description,
    promptVersion,
    outputConfigs: buildOutputConfigsInput(outputConfigs),
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
   * The output configs for the evaluator. Used for prompt tool definitions and GraphQL payload.
   */
  outputConfigs: AnnotationConfig[];
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
  return {
    ...createLLMEvaluatorDefinitionPayload({
      playgroundStore,
      instanceId,
      name: rawName,
      description: rawDescription,
      outputConfigs,
      includeExplanation,
    }),
    datasetId,
    inputMapping,
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
  promptTools?:
    | {
        readonly tools: ReadonlyArray<{
          readonly __typename?: string;
          readonly function?: { readonly parameters: unknown } | null;
        }>;
      }
    | null
    | undefined
): boolean => {
  if (!promptTools || promptTools.tools.length === 0) {
    return false;
  }

  const tool = promptTools.tools.find(
    (tool) => tool.__typename !== "PromptToolRaw" && tool.function != null
  );
  if (!tool?.function) {
    return false;
  }

  try {
    const parameters = tool.function.parameters;
    if (!isObject(parameters)) {
      return false;
    }
    const params = parameters as Record<string, unknown>;
    return (
      isObject(params.properties) &&
      "explanation" in (params.properties as Record<string, unknown>)
    );
  } catch {
    return false;
  }
};

/**
 * Convert an annotation config to the GraphQL AnnotationConfigInput format.
 *
 * This function transforms frontend annotation configs into the format
 * expected by the GraphQL mutations.
 */
const toAnnotationConfigInput = (
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
  freeform?: {
    name: string;
    optimizationDirection: EvaluatorOptimizationDirection;
    threshold?: number | null;
    lowerBound?: number | null;
    upperBound?: number | null;
  };
} => {
  if ("values" in config) {
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

  if ("threshold" in config) {
    const freeformConfig = config as FreeformEvaluatorAnnotationConfig;
    return {
      freeform: {
        name: freeformConfig.name,
        optimizationDirection: freeformConfig.optimizationDirection,
        ...(freeformConfig.threshold != null
          ? { threshold: freeformConfig.threshold }
          : {}),
        ...(freeformConfig.lowerBound != null
          ? { lowerBound: freeformConfig.lowerBound }
          : {}),
        ...(freeformConfig.upperBound != null
          ? { upperBound: freeformConfig.upperBound }
          : {}),
      },
    };
  }

  const continuousConfig = config as ContinuousEvaluatorAnnotationConfig;
  return {
    continuous: {
      name: continuousConfig.name,
      optimizationDirection: continuousConfig.optimizationDirection,
      lowerBound: continuousConfig.lowerBound ?? null,
      upperBound: continuousConfig.upperBound ?? null,
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
const validateOutputConfigNames = (
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
