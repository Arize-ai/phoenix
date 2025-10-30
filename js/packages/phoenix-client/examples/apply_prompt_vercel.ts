/* eslint-disable no-console */
import { createClient } from "../src";
import { getPrompt, toSDK } from "../src/prompts";
import { PromptSelector } from "../src/types/prompts";

import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, jsonSchema } from "ai";

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

  const aiParams = toSDK({
    prompt,
    sdk: "ai",
    variables: {
      question,
    },
  });

  if (!aiParams) {
    throw new Error("Prompt could not be converted to OpenAI params");
  }

  // Apply prompt to a standard text generation call
  // Note: this does not use response format, you must use generateObject or streamObject for that,
  //       see below for an example
  const { text, toolCalls } = await generateText({
    model: openai("gpt-4o"),
    ...aiParams,
  });

  console.log("Text generation result:");
  console.log(text);
  console.log("Tool calls:");
  console.log(toolCalls);

  if (prompt.response_format) {
    // Apply prompt with response format to a generateObject call
    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: jsonSchema(prompt.response_format.json_schema),
      ...aiParams,
    });
    console.log("Object generation result:");
    console.log(object);
  }
};

main();
