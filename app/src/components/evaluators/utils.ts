import { graphql, readInlineData } from "relay-runtime";

import type { CreateDatasetLLMEvaluatorInput } from "@phoenix/components/dataset/__generated__/CreateDatasetEvaluatorSlideover_createLLMEvaluatorMutation.graphql";
import type { UpdateDatasetLLMEvaluatorInput } from "@phoenix/components/dataset/__generated__/EditDatasetEvaluatorSlideover_updateLLMEvaluatorMutation.graphql";
import { utils_datasetExampleToEvaluatorInput_example$key } from "@phoenix/components/evaluators/__generated__/utils_datasetExampleToEvaluatorInput_example.graphql";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { getInstancePromptParamsFromStore } from "@phoenix/pages/playground/playgroundPromptUtils";
import { fromOpenAIToolDefinition } from "@phoenix/schemas";
import {
  CategoricalChoiceToolType,
  CategoricalChoiceToolTypeSchema,
} from "@phoenix/schemas/phoenixToolTypeSchemas";
import { fromOpenAIToolChoice } from "@phoenix/schemas/toolChoiceSchemas";
import type {
  ClassificationEvaluatorAnnotationConfig,
  EvaluatorInputMapping,
} from "@phoenix/types";

const createPromptVersionInput = ({
  playgroundStore,
  instanceId,
  name,
  description,
  outputConfig,
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
   * The input mapping of the evaluator.
   */
  inputMapping?: EvaluatorInputMapping;
  /**
   * The dataset ID to assign the evaluator to.
   */
  datasetId?: string;
}) => {
  const { promptInput, templateFormat } = getInstancePromptParamsFromStore(
    instanceId,
    playgroundStore
  );
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
              name,
              description,
              parameters: {
                type: "object",
                properties: {
                  [outputConfig.name]: {
                    type: "string",
                    enum: outputConfig.values.map((value) => value.label),
                  },
                },
                required: [outputConfig.name],
              },
            },
          } satisfies CategoricalChoiceToolType),
          targetProvider: promptInput.modelProvider,
        }),
      },
    ],
    responseFormat: undefined,
  };

  return prunedPromptInput;
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
}: {
  datasetEvaluatorId: string;
  datasetId: string;
  playgroundStore: ReturnType<typeof usePlaygroundStore>;
  instanceId: number;
  name: string;
  description: string;
  outputConfig: ClassificationEvaluatorAnnotationConfig;
  inputMapping?: EvaluatorInputMapping;
}): UpdateDatasetLLMEvaluatorInput => {
  const name = rawName.trim();
  const description = rawDescription.trim() || undefined;

  const promptVersion = createPromptVersionInput({
    playgroundStore,
    instanceId,
    name,
    description,
    outputConfig,
  });

  return {
    name,
    description,
    datasetEvaluatorId,
    datasetId,
    inputMapping,
    promptVersion,
    outputConfig,
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
   * The dataset ID to assign the evaluator to.
   */
  datasetId: string;
}): CreateDatasetLLMEvaluatorInput => {
  const name = rawName.trim();
  const description = rawDescription.trim() || undefined;

  const promptVersion = createPromptVersionInput({
    playgroundStore,
    instanceId,
    name,
    description,
    outputConfig,
  });

  return {
    name,
    description,
    datasetId,
    inputMapping,
    promptVersion,
    outputConfig,
  };
};

export type CreateLLMEvaluatorPayload = ReturnType<
  typeof createLLMEvaluatorPayload
>;

export type EvaluatorInput = {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  expected: Record<string, unknown>;
};

export const datasetExampleToEvaluatorInput = ({
  exampleRef,
  taskOutput = {},
}: {
  exampleRef: utils_datasetExampleToEvaluatorInput_example$key;
  taskOutput?: Record<string, unknown>;
}): EvaluatorInput => {
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
    expected: example.output,
  };
};

export const EMPTY_EVALUATOR_INPUT: EvaluatorInput = {
  input: {},
  output: {},
  expected: {},
};

export const EMPTY_EVALUATOR_INPUT_STRING = JSON.stringify(
  EMPTY_EVALUATOR_INPUT,
  null,
  2
);
