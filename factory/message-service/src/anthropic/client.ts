import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | undefined;

export function getAnthropicClient(): Anthropic {
  client ??= new Anthropic({
    timeout: 20_000,
    maxRetries: 0,
    defaultHeaders: { "anthropic-beta": "managed-agents-2026-04-01" },
  });
  return client;
}
