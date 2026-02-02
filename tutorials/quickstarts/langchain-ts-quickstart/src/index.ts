/**
 * Simple LangChain TypeScript Application
 *
 * This demonstrates a basic LangChain chain with:
 * - Prompt templates
 * - LLM integration
 * - Phoenix tracing
 *
 * Run with: npm start
 */

// Import instrumentation first - this must be at the top!
import "./instrumentation.js";

import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

async function main() {
  // Check for API key (supports both OpenAI and Anthropic)
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.error("❌ Error: No API key found");
    console.error("   Please set one of:");
    console.error("   - export OPENAI_API_KEY=your-key-here");
    console.error("   - export ANTHROPIC_API_KEY=your-key-here");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("LangChain TypeScript Quickstart");
  console.log("=".repeat(60));
  console.log("");

  // Initialize the LLM based on available API key
  const llm = process.env.ANTHROPIC_API_KEY
    ? new ChatAnthropic({
        modelName: "claude-3-5-sonnet-20241022",
        temperature: 0.7,
      })
    : new ChatOpenAI({
        modelName: "gpt-3.5-turbo",
        temperature: 0.7,
      });

  // Create a prompt template
  const prompt = PromptTemplate.fromTemplate(
    "You are a helpful assistant. Answer the following question in a friendly and concise way.\n\nQuestion: {question}\n\nAnswer:"
  );

  // Create a simple chain: prompt -> llm -> parser
  const chain = RunnableSequence.from([
    prompt,
    llm,
    new StringOutputParser(),
  ]);

  console.log("Running LangChain chain with Phoenix tracing...\n");

  // Example questions
  const questions = [
    "What is the capital of France?",
    "Explain quantum computing in simple terms.",
    "What are the benefits of TypeScript?",
  ];

  // Process multiple questions through the chain
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    console.log(`📝 Question ${i + 1}: ${question}`);
    console.log("   Processing...");

    try {
      const response = await chain.invoke({ question });
      console.log(`   ✅ Answer: ${response}\n`);
    } catch (error) {
      console.error(`   ❌ Error: ${error}\n`);
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("=".repeat(60));
  console.log("✅ All questions processed!");
  console.log("");
  console.log("👀 Open Phoenix UI at http://localhost:6006");
  console.log("");
  console.log("What to look for:");
  console.log("   - Each chain invocation creates a trace");
  console.log("   - The trace includes the prompt, LLM call, and response");
  console.log("   - You can see token usage, latency, and other metrics");
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

