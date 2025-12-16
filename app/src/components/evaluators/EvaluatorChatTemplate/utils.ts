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
  type PlaygroundChatTemplate,
} from "@phoenix/store";
import { ModelConfigByProvider } from "@phoenix/store/preferencesStore";

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
}): InitialPlaygroundState["instances"] => [
  {
    id: generateInstanceId(),
    activeRunId: null,
    template: {
      __type: "chat",
      messages: defaultMessages ?? getDefaultMessages(),
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
