/* eslint-disable no-console */
import { createClient, getPrompt, toSDK } from "../src";
import OpenAI from "openai";

const PROMPT_VERSION_ID = process.env.PROMPT_VERSION_ID!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const client = createClient({
  options: {
    baseUrl: "http://localhost:6006",
  },
});

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const main = async () => {
  console.log(`Getting prompt ${PROMPT_VERSION_ID}`);

  // TODO: Apply variable replacement to the prompt
  const prompt = await getPrompt({
    client,
    prompt: { versionId: PROMPT_VERSION_ID },
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

  for await (const chunk of response) {
    console.log(chunk.choices[0]?.delta?.content);
  }

  console.log("\n\n");
  console.log(`Done!`);
};

main();
