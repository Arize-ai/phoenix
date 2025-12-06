import { DEFAULT_EVALUATOR_TEMPLATE } from "@phoenix/components/evaluators/templates/defaultEvaluatorTemplate";
import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import {
  DEFAULT_INSTANCE_PARAMS,
  generateInstanceId,
  generateMessageId,
  InitialPlaygroundState,
} from "@phoenix/store";
import { ModelConfigByProvider } from "@phoenix/store/preferencesStore";

export const makeLLMEvaluatorInstance = (
  modelConfigByProvider: ModelConfigByProvider
): InitialPlaygroundState["instances"] => [
  {
    id: generateInstanceId(),
    activeRunId: null,
    template: {
      __type: "chat",
      messages: [
        {
          id: generateMessageId(),
          role: "system",
          content: DEFAULT_EVALUATOR_TEMPLATE.systemPrompt,
        },
        {
          id: generateMessageId(),
          role: "user",
          content: DEFAULT_EVALUATOR_TEMPLATE.userPrompt,
        },
      ],
    },
    tools: [],
    model: {
      ...(modelConfigByProvider[DEFAULT_MODEL_PROVIDER] ?? {
        provider: DEFAULT_MODEL_PROVIDER,
        modelName: DEFAULT_MODEL_NAME,
      }),
      invocationParameters: [],
      supportedInvocationParameters: [],
    },
    toolChoice: "required",
    experimentId: null,
    prompt: null,
    repetitions: DEFAULT_INSTANCE_PARAMS().repetitions,
    selectedRepetitionNumber: 1,
  },
];
