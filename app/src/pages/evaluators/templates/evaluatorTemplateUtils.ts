import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import {
  generateInstanceId,
  PlaygroundChatTemplate,
  PlaygroundInstance,
} from "@phoenix/store";

export function transformEvaluatorTemplateToPlaygroundInstance({
  template,
}: {
  template: Readonly<PlaygroundChatTemplate>;
}): PlaygroundInstance {
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
    template,
  };
}
