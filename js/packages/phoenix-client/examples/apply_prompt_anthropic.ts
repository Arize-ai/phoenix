/* eslint-disable no-console */
import { createClient } from "../src";
import { getPrompt, toSDK } from "../src/prompts";
import { PromptSelector } from "../src/types/prompts";

import { Anthropic } from "@anthropic-ai/sdk";

const PROMPT_NAME = process.env.PROMPT_NAME!;
const PROMPT_TAG = process.env.PROMPT_TAG!;
const PROMPT_VERSION_ID = process.env.PROMPT_VERSION_ID!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

// get first argument from command line
const question = process.argv[2];

if (!question) {
  throw new Error(
    "Usage: pnpx tsx examples/apply_prompt_anthropic.ts 'What is the capital of France?'\nAssumes that the prompt has a variable named 'question'"
  );
}

if (!ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY must be provided in the environment");
}

const client = createClient({
  options: {
    baseUrl: "http://localhost:6006",
  },
});

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
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

  const anthropicParams = toSDK({
    prompt,
    sdk: "anthropic",
    variables: {
      question,
    },
  });

  if (!anthropicParams) {
    throw new Error("Prompt could not be converted to Anthropic params");
  }

  // @ts-expect-error Anthropic doesn't support these parameters
  delete anthropicParams.frequency_penalty;
  // @ts-expect-error Anthropic doesn't support these parameters
  delete anthropicParams.presence_penalty;

  console.log(`Applying prompt to Anthropic`);
  const response = await anthropic.messages.create({
    ...anthropicParams,
    // we may not have an anthropic model saved in the prompt
    model: "claude-3-5-sonnet-20240620",
    // TODO: should this be strongly typed inside of toSDK results if sdk: "anthropic"?
    stream: true,
  });

  console.log(`Streaming response from OpenAI:\n\n`);

  let responseText = "";
  let responseJson = "";
  for await (const chunk of response) {
    if (chunk.type === "message_delta") {
      console.clear();
      console.log("Input:\n");
      console.log(JSON.stringify(anthropicParams.messages, null, 2));
      console.log("\nOutput:\n");
      try {
        console.log(JSON.stringify(JSON.parse(responseText), null, 2));
        console.log(JSON.stringify(JSON.parse(responseJson), null, 2));
      } catch {
        console.log(responseText);
        console.log(responseJson);
      }
    } else if (chunk.type === "content_block_delta") {
      console.clear();
      if (chunk.delta.type === "text_delta") {
        responseText += String(chunk.delta.text);
      }
      if (chunk.delta.type === "input_json_delta") {
        responseJson += chunk.delta.partial_json;
      }
      console.log(responseText);
    }
  }

  console.log("\n\n");
  console.log(`Done!`);
};

main();
