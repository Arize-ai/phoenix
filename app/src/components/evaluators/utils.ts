import { ChoiceConfig } from "@phoenix/components/evaluators/EvaluatorLLMChoice";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { CreateLLMEvaluatorInput } from "@phoenix/pages/evaluators/__generated__/NewEvaluatorPageContentMutation.graphql";
import { InputMapping } from "@phoenix/pages/evaluators/EvaluatorInputMapping";
import { getInstancePromptParamsFromStore } from "@phoenix/pages/playground/playgroundPromptUtils";
import { fromOpenAIToolDefinition } from "@phoenix/schemas";
import {
  CategoricalChoiceToolType,
  CategoricalChoiceToolTypeSchema,
} from "@phoenix/schemas/phoenixToolTypeSchemas";

/**
 * Create a payload for the createLLMEvaluator or updateLLMEvaluator mutations.
 */
export const createLLMEvaluatorPayload = ({
  playgroundStore,
  instanceId,
  name: rawName,
  description: rawDescription,
  choiceConfig,
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
}): CreateLLMEvaluatorInput => {
  const { promptInput, templateFormat } = getInstancePromptParamsFromStore(
    instanceId,
    playgroundStore
  );
  const name = rawName.trim();
  const description = rawDescription.trim() || undefined;

  const prunedPromptInput = {
    ...promptInput,
    templateFormat,
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
    // TODO: add input mapping
    promptVersion: prunedPromptInput,
    outputConfig: {
      name: choiceConfig.name,
      optimizationDirection: "MAXIMIZE",
      values: choiceConfig.choices.map((choice) => ({
        label: choice.label,
        score: choice.score,
      })),
    },
  };
};
