import { createAgent } from "../../src/agent/index.js";
import { dateTimeTool, phoenixDocsTool } from "../../src/tools/index.js";

/**
 * Run the agent with a prompt and return the text response
 */
export async function runAgent(prompt: string): Promise<string> {
  const tools = {
    dateTime: dateTimeTool,
    phoenixDocs: phoenixDocsTool,
  };

  const agent = createAgent({ tools });

  const result = await agent.generate({
    prompt,
  });

  const textResponse = result.text?.trim();

  // Ensure we return a non-empty string
  if (!textResponse) {
    throw new Error(`Agent returned empty response for prompt: "${prompt.substring(0, 50)}..."`);
  }

  return textResponse;
}
