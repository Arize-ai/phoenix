import { graphql, readInlineData } from "relay-runtime";

import { CreateLLMEvaluatorInput } from "@phoenix/components/dataset/__generated__/CreateDatasetEvaluatorSlideover_createLLMEvaluatorMutation.graphql";
import { UpdateLLMEvaluatorInput } from "@phoenix/components/evaluators/__generated__/EditEvaluatorSlideover_updateLLMEvaluatorMutation.graphql";
import { utils_datasetExampleToEvaluatorInput_example$key } from "@phoenix/components/evaluators/__generated__/utils_datasetExampleToEvaluatorInput_example.graphql";
import { InputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { ChoiceConfig } from "@phoenix/components/evaluators/EvaluatorLLMChoice";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { getInstancePromptParamsFromStore } from "@phoenix/pages/playground/playgroundPromptUtils";
import { fromOpenAIToolDefinition } from "@phoenix/schemas";
import {
  CategoricalChoiceToolType,
  CategoricalChoiceToolTypeSchema,
} from "@phoenix/schemas/phoenixToolTypeSchemas";
import { fromOpenAIToolChoice } from "@phoenix/schemas/toolChoiceSchemas";

/**
 * Create a payload for the createLLMEvaluator or updateLLMEvaluator mutations.
 */
export const createLLMEvaluatorPayload = ({
  playgroundStore,
  instanceId,
  name: rawName,
  description: rawDescription,
  choiceConfig,
  datasetId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  choiceConfig: ChoiceConfig;
  /**
   * The input mapping of the evaluator.
   */
  inputMapping?: InputMapping;
  /**
   * The dataset ID to assign the evaluator to.
   */
  datasetId?: string;
}): CreateLLMEvaluatorInput | UpdateLLMEvaluatorInput => {
  const { promptInput, templateFormat } = getInstancePromptParamsFromStore(
    instanceId,
    playgroundStore
  );
  const name = rawName.trim();
  const description = rawDescription.trim() || undefined;

  const prunedPromptInput: CreateLLMEvaluatorInput["promptVersion"] = {
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
                  [choiceConfig.name]: {
                    type: "string",
                    enum: choiceConfig.choices.map((choice) => choice.label),
                  },
                },
                required: [choiceConfig.name],
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
    name,
    description,
    datasetId,
    // TODO: add input mapping
    promptVersion: prunedPromptInput,
    outputConfig: {
      name: choiceConfig.name,
      optimizationDirection: choiceConfig.optimizationDirection,
      values: choiceConfig.choices.map((choice) => ({
        label: choice.label,
        score: choice.score,
      })),
    },
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
