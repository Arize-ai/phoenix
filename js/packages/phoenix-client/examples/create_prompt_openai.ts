/* eslint-disable no-console */
import { createPrompt, promptVersion } from "../src/prompts";
import { toSDK } from "../src/prompts";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const main = async () => {
  const prompt = await createPrompt({
    name: "test-prompt",
    description: "test-description",
    version: promptVersion({
      description: "version description here",
      model_provider: "OPENAI",
      model_name: "gpt-4o",
      template: [
        {
          role: "user",
          content: "{{question}}",
        },
      ],
      invocation_parameters: {
        temperature: 0.8,
      },
    }),
  });
  console.log("Prompt Verion:");
  console.dir(prompt, { depth: null });

  const openAIParams = toSDK({
    prompt,
    sdk: "openai",
    variables: {
      question: "What is the capital of France?",
    },
  })!;

  console.log("OpenAI Params:");
  console.dir(openAIParams);

  const response = await openai.chat.completions.create({
    ...openAIParams,
    model: "gpt-4o",
    stream: false,
  });

  console.dir(
    response.choices[0]?.message.content ??
      response.choices[0]?.message.tool_calls,
    { depth: null }
  );
};

main();
