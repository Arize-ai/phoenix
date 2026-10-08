// Observe Your Agent: make one OpenAI call that Phoenix traces.

// docs:start call
import "./instrumentation";
import OpenAI from "openai";
import { provider } from "./instrumentation";

const client = new OpenAI();
await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Why did my invoice change?" }],
});
await provider.shutdown();
// docs:end call
