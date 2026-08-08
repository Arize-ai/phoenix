import { openai } from "@ai-sdk/openai";
import { defineAgent } from "eve";

export default defineAgent({
  // A direct provider model so the example runs with OPENAI_API_KEY alone.
  // Swap in a gateway model id string (e.g. "anthropic/claude-sonnet-5") to
  // route through the Vercel AI Gateway instead.
  model: openai("gpt-4o-mini"),
});
