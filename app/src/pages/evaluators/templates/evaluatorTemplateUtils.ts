import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import { LLMEvaluatorTemplate } from "@phoenix/pages/evaluators/templates/types";
import {
  generateInstanceId,
  generateMessageId,
  PlaygroundInstance,
} from "@phoenix/store";

export function transformEvaluatorTemplateToPlaygroundInstance(
  template: LLMEvaluatorTemplate
): PlaygroundInstance {
  return {
    id: generateInstanceId(),
    tools: [],
    model: {
      provider: DEFAULT_MODEL_PROVIDER,
      modelName: DEFAULT_MODEL_NAME,
      invocationParameters: [],
      supportedInvocationParameters: [],
    },
    spanId: null,
    activeRunId: null,
    template: {
      __type: "chat",
      messages: [
        {
          id: generateMessageId(),
          role: "system",
          content: template.systemPrompt,
        },
        {
          id: generateMessageId(),
          role: "user",
          content: template.userPrompt,
        },
      ],
    },
  };
}
