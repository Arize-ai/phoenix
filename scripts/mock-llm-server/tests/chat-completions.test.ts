import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer, stopServer, getTestClient } from "./setup";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

describe("Chat Completions", () => {
  beforeAll(async () => {
    await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });

  describe("Non-streaming", () => {
    it("should return a valid chat completion", async () => {
      const client = getTestClient();

      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello!" }],
      });

      expect(response.id).toMatch(/^chatcmpl-/);
      expect(response.object).toBe("chat.completion");
      expect(response.model).toBe("gpt-4o");
      expect(response.choices).toHaveLength(1);
      expect(response.choices[0].message.role).toBe("assistant");
      expect(response.choices[0].message.content).toBeTruthy();
      expect(response.choices[0].finish_reason).toBe("stop");
      expect(response.usage).toBeDefined();
      expect(response.usage?.prompt_tokens).toBeGreaterThan(0);
      expect(response.usage?.completion_tokens).toBeGreaterThan(0);
      expect(response.usage?.total_tokens).toBe(
        (response.usage?.prompt_tokens ?? 0) +
          (response.usage?.completion_tokens ?? 0),
      );
    });

    it("should handle multiple messages", async () => {
      const client = getTestClient();

      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello!" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" },
      ];

      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages,
      });

      expect(response.choices[0].message.content).toBeTruthy();
    });

    it("should reject requests without model", async () => {
      const client = getTestClient();

      await expect(
        client.chat.completions.create({
          model: "",
          messages: [{ role: "user", content: "Hello!" }],
        }),
      ).rejects.toThrow();
    });

    it("should reject requests without messages", async () => {
      const client = getTestClient();

      await expect(
        client.chat.completions.create({
          model: "gpt-4o",
          messages: [] as ChatCompletionMessageParam[],
        }),
      ).rejects.toThrow();
    });
  });

  describe("Streaming", () => {
    it("should stream a valid chat completion", async () => {
      const client = getTestClient();

      const stream = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello!" }],
        stream: true,
      });

      const chunks: string[] = [];
      let hasRole = false;
      let hasFinishReason = false;
      let completionId: string | null = null;

      for await (const chunk of stream) {
        if (completionId === null) {
          completionId = chunk.id;
        } else {
          // All chunks should have the same ID
          expect(chunk.id).toBe(completionId);
        }

        expect(chunk.object).toBe("chat.completion.chunk");
        expect(chunk.model).toBe("gpt-4o");

        if (chunk.choices[0]?.delta.role === "assistant") {
          hasRole = true;
        }

        if (chunk.choices[0]?.delta.content) {
          chunks.push(chunk.choices[0].delta.content);
        }

        if (chunk.choices[0]?.finish_reason === "stop") {
          hasFinishReason = true;
        }
      }

      expect(hasRole).toBe(true);
      expect(hasFinishReason).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);

      const fullContent = chunks.join("");
      expect(fullContent).toBeTruthy();
      expect(fullContent.length).toBeGreaterThan(10);
    });

    it("should include usage when stream_options.include_usage is true", async () => {
      const client = getTestClient();

      const stream = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello!" }],
        stream: true,
        stream_options: { include_usage: true },
      });

      let hasUsage = false;

      for await (const chunk of stream) {
        if (chunk.usage) {
          hasUsage = true;
          expect(chunk.usage.prompt_tokens).toBeGreaterThan(0);
          expect(chunk.usage.completion_tokens).toBeGreaterThan(0);
          expect(chunk.usage.total_tokens).toBe(
            chunk.usage.prompt_tokens + chunk.usage.completion_tokens,
          );
        }
      }

      expect(hasUsage).toBe(true);
    });
  });
});
