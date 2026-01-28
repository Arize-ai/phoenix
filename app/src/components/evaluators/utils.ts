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
  outputConfig,
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
  outputConfig: ClassificationEvaluatorAnnotationConfig;
  inputMapping?: EvaluatorInputMapping;
  includeExplanation: boolean;
}): UpdateDatasetLLMEvaluatorInput => {
  const name = rawName.trim();
  const description = rawDescription.trim() || undefined;

  const { prunedPromptInput: promptVersion, promptVersionId } =
    createPromptVersionInput({
      playgroundStore,
      instanceId,
      name,
      description,
      outputConfig,
      includeExplanation,
    });

  return {
    name,
    description,
    datasetEvaluatorId,
    datasetId,
    inputMapping: inputMapping,
    promptVersion,
    outputConfig: outputConfig,
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
  outputConfig,
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
   * The choice config of the evaluator.
   */
  outputConfig: ClassificationEvaluatorAnnotationConfig;
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

  const { prunedPromptInput: promptVersion, promptVersionId } =
    createPromptVersionInput({
      playgroundStore,
      instanceId,
      name,
      description,
      outputConfig,
      includeExplanation,
    });

  return {
    name,
    description,
    datasetId,
    inputMapping: inputMapping,
    promptVersion,
    outputConfig: outputConfig,
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
      }
    `,
    exampleRef
  );
  return {
    input: example.input,
    output: taskOutput,
    reference: example.output,
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
 * Build the output config override from the store's output config.
 *
 * This determines whether the config is categorical (has "values" property)
 * or continuous and constructs the appropriate override structure.
 */
export const buildOutputConfigOverride = (
  outputConfig:
    | ClassificationEvaluatorAnnotationConfig
    | ContinuousEvaluatorAnnotationConfig
    | null
    | undefined
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
