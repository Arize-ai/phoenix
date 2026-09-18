import { traceChain } from "@arizeai/openinference-core";

declare const model: {
  generate(prompt: string): Promise<{
    text: string;
    usage: { promptTokens: number; completionTokens: number };
  }>;
};

// Everything here is operational. `access_token_count` trips a naive
// /token/ denylist but is a number of tokens, not a token.
export function tracedGenerate(
  prompt: string,
  requestId: string,
  startedAt: number
) {
  return traceChain(async () => model.generate(prompt), {
    name: "generate",
    attributes: {
      "metadata.request_id": requestId,
      "metadata.access_token_count": prompt.length / 4,
      "metadata.latency_ms": Date.now() - startedAt,
      "metadata.model": "gpt-4o-mini",
    },
  });
}
