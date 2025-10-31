/* eslint-disable no-console */
import { createClient } from "../src";
import { getPrompt, toSDK } from "../src/prompts";
import { PromptSelector } from "../src/types/prompts";

import OpenAI from "openai";

const PROMPT_NAME = process.env.PROMPT_NAME!;
const PROMPT_TAG = process.env.PROMPT_TAG!;
const PROMPT_VERSION_ID = process.env.PROMPT_VERSION_ID!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

// get first argument from command line
const question = process.argv[2];

if (!question) {
  throw new Error(
    "Usage: pnpx tsx examples/apply_prompt_openai.ts 'What is the capital of France?'\nAssumes that the prompt has a variable named 'question'"
  );
}

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be provided in the environment");
}

const client = createClient({
  options: {
    baseUrl: "http://localhost:6006",
  },
});

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const main = async () => {
  const promptArgument: PromptSelector | null = PROMPT_VERSION_ID
    ? { versionId: PROMPT_VERSION_ID }
    : PROMPT_TAG && PROMPT_NAME
      ? { name: PROMPT_NAME, tag: PROMPT_TAG }
      : PROMPT_NAME
        ? { name: PROMPT_NAME }
        : null;
  if (!promptArgument) {
    throw new Error(
      `Either PROMPT_VERSION_ID, PROMPT_TAG and PROMPT_NAME, or PROMPT_NAME must be provided in the environment`
    );
  }
  console.log(`Getting prompt ${JSON.stringify(promptArgument)}`);

  const prompt = await getPrompt({
    client,
    prompt: promptArgument,
  });

  if (!prompt) {
    throw new Error("Prompt not found");
  }

  console.log(
    `Loaded prompt: ${prompt.id}\n${prompt.description ? `\n${prompt.description}` : ""}`
  );

  console.log(`Converting prompt to OpenAI params`);

  const openAIParams = toSDK({
    prompt,
    sdk: "openai",
    variables: {
      question,
    },
  });

  if (!openAIParams) {
    throw new Error("Prompt could not be converted to OpenAI params");
  }

  console.log(`Applying prompt to OpenAI`);
  const response = await openai.chat.completions.create({
    ...openAIParams,
    // we may not have an openai model saved in the prompt
    model: "gpt-4o-mini",
    // TODO: should this be strongly typed inside of toSDK results if sdk: "openai"?
    stream: true,
  });

  console.log(`Streaming response from OpenAI:\n\n`);

  let responseText = "";
  for await (const chunk of response) {
    if (chunk.choices[0]?.delta?.content) {
      responseText += chunk.choices[0]?.delta?.content;
      console.clear();
      console.log("Input:\n");
      console.log(JSON.stringify(openAIParams.messages, null, 2));
      console.log("\nOutput:\n");
      try {
        console.log(JSON.stringify(JSON.parse(responseText), null, 2));
      } catch {
        console.log(responseText);
      }
    } else if (chunk.choices[0]?.delta?.tool_calls) {
      console.log(chunk.choices[0]?.delta?.tool_calls);
    }
  }

  console.log("\n\n");
  console.log(`Done!`);
};

main();
