/* eslint-disable no-console */
import { createClient, getPrompt, toSDK } from "../src";
import OpenAI from "openai";

const PROMPT_NAME = process.env.PROMPT_NAME!;
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
  baseURL: "http://m4-mini:11434/v1",
});

const main = async () => {
  const prompt = await getPrompt({
    client,
    prompt: { name: PROMPT_NAME },
  });

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
    stream: false,
  });

  console.log(response.choices[0]?.message.content);
};

main();
