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
    "Usage: pnpx tsx examples/apply_prompt.ts 'What is the capital of France?'\nAssumes that the prompt has a variable named 'question'\nAssumes that the prompt is openai with an openai model"
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
