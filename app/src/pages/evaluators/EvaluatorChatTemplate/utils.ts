import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import { createToolForProvider } from "@phoenix/pages/playground/playgroundUtils";
import {
  generateChatCompletionTemplate,
  generateInstanceId,
  InitialPlaygroundState,
} from "@phoenix/store";
import { ModelConfigByProvider } from "@phoenix/store/preferencesStore";

export const makeLLMEvaluatorInstance = (
  modelConfigByProvider: ModelConfigByProvider
): InitialPlaygroundState["instances"] => [
  {
    id: generateInstanceId(),
    activeRunId: null,
    spanId: null,
    template: generateChatCompletionTemplate(),
    tools: [
      createToolForProvider({
        provider: DEFAULT_MODEL_PROVIDER,
        toolNumber: 0,
        type: "categorical_choice",
        definition: {
          type: "function",
          function: {
            name: "categorical_choice",
            description: "A categorical choice tool",
            parameters: {
              type: "object",
              properties: {
                choice: {
                  type: "string",
                  enum: ["choice1", "choice2", "choice3"],
                },
              },
              required: ["choice"],
            },
          },
        },
      }),
    ],
    model: {
      ...(modelConfigByProvider[DEFAULT_MODEL_PROVIDER] ?? {
        provider: DEFAULT_MODEL_PROVIDER,
        modelName: DEFAULT_MODEL_NAME,
      }),
      invocationParameters: [],
      supportedInvocationParameters: [],
    },
    toolChoice: "required",
    output: undefined,
    experimentId: null,
    prompt: null,
  },
];
