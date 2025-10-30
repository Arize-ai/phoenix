/* eslint-disable no-console */
import { createClient } from "../src";
import { createPrompt, promptVersion, toSDK } from "../src/prompts";

import OpenAI from "openai";

// Optional: create a phoenix client to explicitly set the credentials
const client = createClient({
  options: {
    baseUrl: "http://localhost:6006",
    // headers: {
    //   Authorization: `Bearer ${process.env.PHOENIX_API_KEY}`,
    // },
  },
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const main = async () => {
  const prompt = await createPrompt({
    client,
    name: "test-prompt",
    description: "test-description",
    version: promptVersion({
      description: "version description here",
      modelProvider: "OPENAI",
      modelName: "gpt-4o",
      template: [
        {
          role: "user",
          content: "{{question}}",
        },
      ],
      invocationParameters: {
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
