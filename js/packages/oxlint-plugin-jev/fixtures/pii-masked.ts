import { getInputAttributes, withSpan } from "@arizeai/openinference-core";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";

interface User {
  id: string;
  email: string;
  fullName: string;
}
declare const agent: {
  generate(input: { prompt: string }): Promise<{ text: string }>;
};

// Whole-record input is serialized, but inputs are masked, so this is fine.
export const instrumentation = new OpenAIInstrumentation({
  traceConfig: { hideInputs: true, hideOutputs: true },
});

export const handleUser = withSpan(
  async (user: User) => agent.generate({ prompt: user.fullName }),
  {
    name: "handle-user",
    kind: "CHAIN",
    attributes: { "metadata.user_count": 1 },
    processInput: (user: User) => getInputAttributes(user),
  }
);
