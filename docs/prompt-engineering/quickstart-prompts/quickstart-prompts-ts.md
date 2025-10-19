---
description: >-
  This guide will walk you through setting up and using Phoenix Prompts with
  TypeScript.
---

# Quickstart: Prompts (TS)

## Installation

First, install the [Phoenix client library](https://www.npmjs.com/package/@arizeai/phoenix-client):

```bash
npm install @arizeai/phoenix-client
```

## Creating a Prompt

Let's start by creating a simple prompt in Phoenix using the TypeScript client:

```typescript
import { createClient } from "@arizeai/phoenix-client";
import { createPrompt, promptVersion } from "@arizeai/phoenix-client/prompts";

// Create a Phoenix client 
// (optional, the createPrompt function will create one if not provided)
const client = createClient({
  options: {
    baseUrl: "http://localhost:6006", // Change to your Phoenix server URL
    // If your Phoenix instance requires authentication:
    // headers: {
    //   Authorization: "bearer YOUR_API_KEY",
    // }
  }
});

// Define a simple summarization prompt
const summarizationPrompt = await createPrompt({
  client,
  name: "article-summarizer",
  description: "Summarizes an article into concise bullet points",
  version: promptVersion({
    description: "Initial version",
    templateFormat: "MUSTACHE",
    modelProvider: "OPENAI", // Could also be ANTHROPIC, GEMINI, etc.
    modelName: "gpt-3.5-turbo",
    template: [
      {
        role: "system",
        content: "You are an expert summarizer. Create clear, concise bullet points highlighting the key information."
      },
      {
        role: "user",
        content: "Please summarize the following {{topic}} article:\n\n{{article}}"
      }
    ],
  })
});

console.dir(summarizationPrompt);
```

## Getting a Prompt

You can retrieve prompts by name, ID, version, or tag:

```typescript
import { getPrompt } from "@arizeai/phoenix-client/prompts";

// Get by name (latest version)
const latestPrompt = await getPrompt({
  prompt: {
    name: "article-summarizer",
  }
});

// Get by specific version ID
const specificVersionPrompt = await getPrompt({ 
  prompt: {
    versionId: "abcd1234",
  },
});

// Get by tag (e.g., "production", "staging", "development")
const productionPrompt = await getPrompt({ 
  prompt: {
    name: "article-summarizer", 
    tag: "production", 
  }
});
```

## Using a Prompt with SDKs

Phoenix makes it easy to use your prompts with various SDKs, no proprietary SDK necessary!  Here's how to use a prompt with OpenAI:

```typescript
import { getPrompt, toSDK } from "@arizeai/phoenix-client/prompts";
import OpenAI from "openai";

// Initialize your OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Get your prompt
const prompt = await getPrompt({
  prompt: {
    name: "article-summarizer",
  },
});

// Make sure the prompt was properly fetched
if (!prompt) {
  throw new Error("Prompt not found");
}

// Transform the prompt to OpenAI format with variable values
const openaiParameters = toSDK({
  sdk: "openai", 
  prompt,
  variables: {
    topic: "technology",
    article:
      "Artificial intelligence has seen rapid advancement in recent years. Large language models like GPT-4 can now generate human-like text, code, and even create images from descriptions. This technology is being integrated into many industries, from healthcare to finance, transforming how businesses operate and people work.",
  },
});

// Make sure the prompt was successfully converted to parameters
if (!openaiParameters) {
  throw new Error("OpenAI parameters not found");
}

// Use the transformed parameters with OpenAI
const response = await openai.chat.completions.create({
  ...openaiParameters,
  // You can override any parameters here
  model: "gpt-4o-mini", // Override the model if needed
  stream: false,
});


console.log("Summary:", response.choices[0].message.content);
```

The Phoenix client natively supports passing your prompts to OpenAI, Anthropic, and the[ Vercel AI SDK](https://sdk.vercel.ai/docs/introduction).

## Next Steps

* Check out the [how-to-prompts](../how-to-prompts/ "mention") section for details on how to test prompt changes
* Take a look a the TypeScript examples in the Phoenix client ([https://github.com/Arize-ai/phoenix/tree/main/js/packages/phoenix-client/examples](https://github.com/Arize-ai/phoenix/tree/main/js/packages/phoenix-client/examples))
* Try out some Demo notebooks to experiment with prompts ([https://github.com/Arize-ai/phoenix/tree/main/js/examples/notebooks](https://github.com/Arize-ai/phoenix/tree/main/js/examples/notebooks))

