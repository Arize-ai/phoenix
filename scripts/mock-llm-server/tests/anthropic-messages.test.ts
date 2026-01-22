import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer, stopServer, getBaseUrl } from "./setup";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";

function getAnthropicClient(): Anthropic {
  // Anthropic SDK automatically adds /v1 to the base URL
  return new Anthropic({
    baseURL: getBaseUrl(),
    apiKey: "test-key",
  });
}

describe("Anthropic Messages API", () => {
  beforeAll(async () => {
    await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });

  describe("Non-streaming", () => {
    it("should return a valid message response", async () => {
      const client = getAnthropicClient();

      const response = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hello!" }],
      });

      expect(response.id).toMatch(/^msg_01/);
      expect(response.type).toBe("message");
      expect(response.role).toBe("assistant");
      expect(response.model).toBe("claude-3-5-sonnet-20241022");
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe("text");
      if (response.content[0].type === "text") {
        expect(response.content[0].text).toBeTruthy();
      }
      expect(response.stop_reason).toBe("end_turn");
      expect(response.usage).toBeDefined();
      expect(response.usage.input_tokens).toBeGreaterThan(0);
      expect(response.usage.output_tokens).toBeGreaterThan(0);
    });

    it("should handle multiple messages", async () => {
      const client = getAnthropicClient();

      const messages: MessageParam[] = [
        { role: "user", content: "Hello!" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" },
      ];

      const response = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages,
      });

      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe("text");
    });

    it("should handle system prompt", async () => {
      const client = getAnthropicClient();

      const response = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        system: "You are a helpful assistant.",
        messages: [{ role: "user", content: "Hello!" }],
      });

      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe("text");
    });

    it("should reject requests without model", async () => {
      const client = getAnthropicClient();

      await expect(
        client.messages.create({
          model: "",
          max_tokens: 1024,
          messages: [{ role: "user", content: "Hello!" }],
        })
      ).rejects.toThrow();
    });

    it("should reject requests without messages", async () => {
      const client = getAnthropicClient();

      await expect(
        client.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1024,
          messages: [] as MessageParam[],
        })
      ).rejects.toThrow();
    });

    it("should reject requests without max_tokens", async () => {
      const response = await fetch(`${getBaseUrl()}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "test-key",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          messages: [{ role: "user", content: "Hello!" }],
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.type).toBe("error");
      expect(data.error.type).toBe("invalid_request_error");
      expect(data.error.message).toContain("max_tokens");
    });
  });

  describe("Streaming", () => {
    it("should stream a valid message response", async () => {
      const client = getAnthropicClient();

      const stream = client.messages.stream({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hello!" }],
      });

      const chunks: string[] = [];
      let hasMessageStart = false;
      let hasContentBlockStart = false;
      let hasContentBlockStop = false;
      let hasMessageDelta = false;
      let hasMessageStop = false;

      for await (const event of stream) {
        if (event.type === "message_start") {
          hasMessageStart = true;
          expect(event.message.id).toMatch(/^msg_01/);
          expect(event.message.role).toBe("assistant");
        }
        if (event.type === "content_block_start") {
          hasContentBlockStart = true;
          expect(event.index).toBe(0);
          expect(event.content_block.type).toBe("text");
        }
        if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            chunks.push(event.delta.text);
          }
        }
        if (event.type === "content_block_stop") {
          hasContentBlockStop = true;
        }
        if (event.type === "message_delta") {
          hasMessageDelta = true;
          expect(event.delta.stop_reason).toBe("end_turn");
          expect(event.usage.output_tokens).toBeGreaterThan(0);
        }
        if (event.type === "message_stop") {
          hasMessageStop = true;
        }
      }

      expect(hasMessageStart).toBe(true);
      expect(hasContentBlockStart).toBe(true);
      expect(hasContentBlockStop).toBe(true);
      expect(hasMessageDelta).toBe(true);
      expect(hasMessageStop).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);

      const fullContent = chunks.join("");
      expect(fullContent).toBeTruthy();
      expect(fullContent.length).toBeGreaterThan(10);
    });

    it("should provide accumulated final message", async () => {
      const client = getAnthropicClient();

      const stream = client.messages.stream({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{ role: "user", content: "Hello!" }],
      });

      // Consume the stream
      for await (const _event of stream) {
        // Just consume events
      }

      const finalMessage = await stream.finalMessage();
      expect(finalMessage.id).toMatch(/^msg_01/);
      expect(finalMessage.content.length).toBeGreaterThan(0);
      expect(finalMessage.stop_reason).toBe("end_turn");
    });
  });

  describe("Tool Use", () => {
    const tools: Tool[] = [
      {
        name: "get_weather",
        description: "Get the weather for a location",
        input_schema: {
          type: "object" as const,
          properties: {
            location: { type: "string", description: "City name" },
            unit: { type: "string", enum: ["celsius", "fahrenheit"] },
          },
          required: ["location"],
        },
      },
    ];

    it("should return tool use in non-streaming mode", async () => {
      // Start server with 100% tool call probability
      await stopServer();
      await startServer({ TOOL_CALL_PROBABILITY: "1.0" });

      const client = getAnthropicClient();

      const response = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{ role: "user", content: "What's the weather in San Francisco?" }],
        tools,
      });

      expect(response.stop_reason).toBe("tool_use");

      // Should have text and tool_use blocks
      const toolUseBlock = response.content.find((c) => c.type === "tool_use");
      expect(toolUseBlock).toBeDefined();

      if (toolUseBlock && toolUseBlock.type === "tool_use") {
        expect(toolUseBlock.id).toMatch(/^toolu_01/);
        expect(toolUseBlock.name).toBe("get_weather");
        expect(toolUseBlock.input).toBeDefined();
        expect(typeof toolUseBlock.input).toBe("object");
      }
    });

    it("should stream tool use correctly", async () => {
      // Ensure we have 100% tool call probability
      await stopServer();
      await startServer({ TOOL_CALL_PROBABILITY: "1.0" });

      const client = getAnthropicClient();

      const stream = client.messages.stream({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{ role: "user", content: "What's the weather?" }],
        tools,
      });

      let hasToolUseStart = false;
      let hasInputJsonDelta = false;
      let toolUseId: string | null = null;
      let toolName: string | null = null;
      const jsonChunks: string[] = [];

      for await (const event of stream) {
        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          hasToolUseStart = true;
          toolUseId = event.content_block.id;
          toolName = event.content_block.name;
        }
        if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
          hasInputJsonDelta = true;
          jsonChunks.push(event.delta.partial_json);
        }
        if (event.type === "message_delta") {
          expect(event.delta.stop_reason).toBe("tool_use");
        }
      }

      expect(hasToolUseStart).toBe(true);
      expect(hasInputJsonDelta).toBe(true);
      expect(toolUseId).toMatch(/^toolu_01/);
      expect(toolName).toBe("get_weather");

      // JSON chunks should form valid JSON when concatenated
      const fullJson = jsonChunks.join("");
      expect(() => JSON.parse(fullJson)).not.toThrow();
    });

    it("should respect tool_choice none", async () => {
      const client = getAnthropicClient();

      const response = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{ role: "user", content: "What's the weather?" }],
        tools,
        tool_choice: { type: "none" },
      });

      expect(response.stop_reason).toBe("end_turn");
      const toolUseBlock = response.content.find((c) => c.type === "tool_use");
      expect(toolUseBlock).toBeUndefined();
    });
  });
});
