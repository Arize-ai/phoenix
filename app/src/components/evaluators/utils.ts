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

export const createEvaluatorPayload = ({
  store,
  instanceId,
  name: rawName,
  description: rawDescription,
  choiceConfig,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  inputMapping,
}: {
  store: ReturnType<typeof usePlaygroundStore>;
  instanceId: number;
  name: string;
  description: string;
  choiceConfig: ChoiceConfig;
  inputMapping: InputMapping;
}): CreateLLMEvaluatorInput => {
  const { promptInput, templateFormat } = getInstancePromptParamsFromStore(
    instanceId,
    store
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
