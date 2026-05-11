import { DEFAULT_EVALUATOR_TEMPLATE } from "@phoenix/components/evaluators/templates/defaultEvaluatorTemplate";
import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import {
  getDefaultInvocationConfig,
  parseInvocationConfig,
} from "@phoenix/pages/playground/providerAdapters";
import type { InitialPlaygroundState } from "@phoenix/store";
import {
  DEFAULT_INSTANCE_PARAMS,
  generateInstanceId,
  generateMessageId,
  type PlaygroundChatTemplate,
} from "@phoenix/store";
import type { ModelConfigByProvider } from "@phoenix/store/preferencesStore";

const getDefaultMessages: () => PlaygroundChatTemplate["messages"] = () => [
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
];

export const makeLLMEvaluatorInstance = ({
  modelConfigByProvider,
  defaultMessages,
}: {
  defaultMessages?: PlaygroundChatTemplate["messages"];
  modelConfigByProvider: ModelConfigByProvider;
}): InitialPlaygroundState["instances"] => {
  const savedModelConfig = modelConfigByProvider[DEFAULT_MODEL_PROVIDER];
  const baseModelConfig = savedModelConfig ?? {
    provider: DEFAULT_MODEL_PROVIDER,
    modelName: DEFAULT_MODEL_NAME,
  };
  const savedInvocationParameters = savedModelConfig?.invocationParameters;
  const invocationParameters =
    savedInvocationParameters != null
      ? parseInvocationConfig(DEFAULT_MODEL_PROVIDER, savedInvocationParameters)
      : getDefaultInvocationConfig(DEFAULT_MODEL_PROVIDER);
  return [
    {
      id: generateInstanceId(),
      activeRunId: null,
      template: {
        __type: "chat",
        messages: defaultMessages ?? getDefaultMessages(),
      },
      tools: [],
      model: {
        ...baseModelConfig,
        invocationParameters,
      },
      toolChoice: { type: "ONE_OR_MORE" },
      experiment: null,
      prompt: null,
      repetitions: DEFAULT_INSTANCE_PARAMS().repetitions,
      selectedRepetitionNumber: 1,
    },
  ];
};
