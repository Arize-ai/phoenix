import { faker } from "@faker-js/faker";
import type { ServerConfig } from "./types.js";

/**
 * Pool of dynamic responses when DEFAULT_RESPONSE is not set
 */
const DYNAMIC_RESPONSES = [
  // Standard helpful responses
  "I understand your question. Let me provide a helpful response based on the context you've shared. The mock server is designed to simulate realistic API behavior for testing purposes.",
  "Thank you for reaching out! This is a simulated response from the mock OpenAI server. It supports streaming, tool calls, and various configuration options for comprehensive testing.",
  "Great question! Here's what I can tell you: the mock server faithfully replicates OpenAI's API behavior, making it ideal for development and testing scenarios.",
  "I'd be happy to help with that. This response demonstrates the mock server's capability to generate varied, realistic-looking outputs for your testing needs.",
  "Let me think about this carefully. The mock API simulator provides a controlled environment for testing LLM integrations without making actual API calls.",
  "That's an interesting point. As a mock response, I'm here to help you validate your application's handling of AI-generated content in a predictable way.",
  "Here's my analysis: the mock server supports both streaming and non-streaming modes, rate limiting simulation, and tool call generation based on provided schemas.",
  "I appreciate the question! This dynamic response system ensures that each API call returns slightly different content, better simulating real-world API behavior.",

  // Longer, more detailed responses
  "That's a great question to explore. When working with AI systems, it's important to consider both the immediate use case and the broader implications. The mock server helps you test these interactions in a controlled environment, allowing you to iterate quickly without incurring API costs or dealing with rate limits during development.",
  "Let me break this down step by step. First, the mock server receives your request just like the real OpenAI API would. Then, it processes the request parameters, including any tools you've defined. Finally, it generates a response that matches the expected format, making it seamless to switch between mock and production environments.",
  "I've analyzed your request and here's what I found. The mock OpenAI server is particularly useful for integration testing, load testing, and developing offline. It supports all the key features you'd expect: streaming responses with configurable delays, tool calls with schema-based argument generation, and realistic rate limiting simulation.",

  // Shorter, concise responses
  "Certainly! The mock server is working as expected.",
  "Got it. Here's a simulated response for your testing needs.",
  "Understood. This response validates your API integration is functioning correctly.",
  "Sure thing! Everything looks good on the mock server side.",
  "Absolutely. Your request was processed successfully by the simulator.",

  // Technical/informative responses
  "Based on my analysis, the key considerations here involve balancing performance with reliability. The mock server helps you test edge cases that might be difficult to reproduce with the real API, such as specific rate limiting scenarios or timeout behaviors.",
  "From a technical perspective, the mock server implements the OpenAI API specification faithfully. This includes proper SSE formatting for streaming responses, correct header handling, and accurate response schemas for both chat completions and the newer responses API.",
  "The architecture of the mock server is designed for extensibility. You can configure response delays, tool call probabilities, and rate limiting behavior through environment variables, making it adaptable to various testing scenarios.",

  // Conversational responses
  "Oh, that's an interesting way to think about it! The mock server gives you the freedom to experiment without worrying about API quotas or costs. It's like having a sandbox where you can test as much as you want.",
  "You know, that reminds me of why we built this in the first place. Testing LLM integrations can be tricky because real APIs have rate limits and cost money. This mock server solves both problems while still giving you realistic behavior.",
  "Hmm, let me consider that for a moment. The beauty of having a mock server is that you can test failure scenarios intentionally. Want to see how your app handles rate limiting? Just flip a config switch and you're testing that edge case.",

  // Question-answering style responses
  "To answer your question directly: yes, the mock server supports that functionality. It's designed to be a drop-in replacement for the OpenAI API during development and testing phases.",
  "The short answer is that this works exactly as you'd expect. The longer answer involves understanding how the mock server processes requests and generates responses that match the OpenAI API specification.",
  "In response to your query, I can confirm that the mock server handles this case appropriately. The response format matches what you'd receive from the actual OpenAI API.",
];

/**
 * Generate lorem ipsum paragraphs using Faker
 */
function generateLoremIpsum(): string {
  const paragraphCount = faker.number.int({ min: 2, max: 5 });
  return faker.lorem.paragraphs(paragraphCount, "\n\n");
}

/**
 * Generate a dynamic response, randomly selecting from the pool
 * 50% of the time, generates lorem ipsum paragraphs instead
 */
function createResponseGenerator(): () => string {
  const envResponse = process.env.DEFAULT_RESPONSE;
  if (envResponse) {
    // If DEFAULT_RESPONSE is set, always return it
    return () => envResponse;
  }
  // Otherwise, return a random response from the pool (50%) or lorem ipsum (50%)
  return () => {
    if (Math.random() < 0.5) {
      return generateLoremIpsum();
    }
    return DYNAMIC_RESPONSES[
      Math.floor(Math.random() * DYNAMIC_RESPONSES.length)
    ];
  };
}

/**
 * Server configuration with environment variable overrides
 */
export function getConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT || "57593", 10),

    // Rate limiting
    rateLimitEnabled: process.env.RATE_LIMIT_ENABLED === "true",
    rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS || "10", 10),
    rateLimitWindowMs: parseInt(
      process.env.RATE_LIMIT_WINDOW_MS || "60000",
      10,
    ),
    rateLimitFailureMode: (process.env.RATE_LIMIT_MODE || "after_n") as
      | "always"
      | "random"
      | "after_n",
    rateLimitRandomProbability: parseFloat(
      process.env.RATE_LIMIT_RANDOM_PROBABILITY || "0.3",
    ),
    rateLimitAfterN: parseInt(process.env.RATE_LIMIT_AFTER_N || "5", 10),

    // Streaming
    streamInitialDelayMs: parseInt(
      process.env.STREAM_INITIAL_DELAY_MS || "300",
      10,
    ),
    streamDelayMs: parseInt(process.env.STREAM_DELAY_MS || "50", 10),
    streamJitterMs: parseInt(process.env.STREAM_JITTER_MS || "30", 10),
    streamChunkSize: parseInt(process.env.STREAM_CHUNK_SIZE || "10", 10),

    // Tool calls
    toolCallProbability: parseFloat(
      process.env.TOOL_CALL_PROBABILITY || "0.75",
    ),

    // Response content
    getDefaultResponse: createResponseGenerator(),
  };
}

/**
 * Print configuration to console
 */
export function printConfig(config: ServerConfig): void {
  console.log("\n📋 Server Configuration:");
  console.log("━".repeat(50));
  console.log(`  Port: ${config.port}`);
  console.log(
    `  Rate Limiting: ${config.rateLimitEnabled ? "Enabled" : "Disabled"}`,
  );
  if (config.rateLimitEnabled) {
    console.log(`    Mode: ${config.rateLimitFailureMode}`);
    console.log(`    Requests/Window: ${config.rateLimitRequests}`);
    console.log(`    Window: ${config.rateLimitWindowMs}ms`);
    if (config.rateLimitFailureMode === "random") {
      console.log(
        `    Random Probability: ${config.rateLimitRandomProbability * 100}%`,
      );
    }
    if (config.rateLimitFailureMode === "after_n") {
      console.log(`    Fail After: ${config.rateLimitAfterN} requests`);
    }
  }
  console.log(`  Stream Initial Delay: ${config.streamInitialDelayMs}ms`);
  console.log(
    `  Stream Delay: ${config.streamDelayMs}ms (±${config.streamJitterMs}ms jitter)`,
  );
  console.log(`  Stream Chunk Size: ${config.streamChunkSize} chars`);
  console.log(`  Tool Call Probability: ${config.toolCallProbability * 100}%`);
  console.log(
    `  Response Mode: ${process.env.DEFAULT_RESPONSE ? "Static (from env)" : "Dynamic (random from pool)"}`,
  );
  console.log("━".repeat(50));
}
