import { createPrompt, promptVersion } from "../src/prompts";

const version = createPrompt({
  name: "test-prompt",
  description: "test-description",
  version: promptVersion({
    description: "version description here",
    model_provider: "OPENAI",
    model_name: "gpt-3.5-turbo",
    template: [
      {
        role: "user",
        content: "{{ question }}",
      },
    ],
    invocation_parameters: {
      temperature: 0.8,
    },
  }),
});
