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
    variables: {
      question: "When does Monster Hunter Wilds come out?",
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
