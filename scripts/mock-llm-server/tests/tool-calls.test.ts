import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer, stopServer, getTestClient } from "./setup";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

describe("Tool Calls", () => {
  beforeAll(async () => {
    await startServer({
      TOOL_CALL_PROBABILITY: "1.0", // Always make tool calls for deterministic tests
    });
  });

  afterAll(async () => {
    await stopServer();
  });

  const weatherTool: ChatCompletionTool = {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
          unit: { type: "string", enum: ["celsius", "fahrenheit"] },
        },
        required: ["location"],
      },
    },
  };

  const calculatorTool: ChatCompletionTool = {
    type: "function",
    function: {
      name: "calculator",
      description: "Perform a calculation",
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["add", "subtract", "multiply", "divide"],
          },
          a: { type: "number" },
          b: { type: "number" },
        },
        required: ["operation", "a", "b"],
      },
    },
  };

  describe("Non-streaming", () => {
    it("should return a tool call when tools are provided", async () => {
      const client = getTestClient();

      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "What's the weather?" }],
        tools: [weatherTool],
        tool_choice: "required",
      });

      expect(response.choices[0].finish_reason).toBe("tool_calls");
      expect(response.choices[0].message.tool_calls).toBeDefined();
      expect(response.choices[0].message.tool_calls).toHaveLength(1);

      const toolCall = response.choices[0].message.tool_calls![0];
      expect(toolCall.id).toMatch(/^call_/);
      expect(toolCall.type).toBe("function");
      expect(toolCall.function.name).toBe("get_weather");

      // Arguments should be valid JSON
      const args = JSON.parse(toolCall.function.arguments);
      expect(args).toHaveProperty("location");
      expect(typeof args.location).toBe("string");
    });

    it("should generate arguments matching the schema", async () => {
      const client = getTestClient();

      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Calculate something" }],
        tools: [calculatorTool],
        tool_choice: "required",
      });

      const toolCall = response.choices[0].message.tool_calls![0];
      expect(toolCall.function.name).toBe("calculator");

      const args = JSON.parse(toolCall.function.arguments);
      expect(args).toHaveProperty("operation");
      expect(args).toHaveProperty("a");
      expect(args).toHaveProperty("b");
      expect(["add", "subtract", "multiply", "divide"]).toContain(
        args.operation,
      );
      expect(typeof args.a).toBe("number");
      expect(typeof args.b).toBe("number");
    });

    it("should pick from multiple tools", async () => {
      const client = getTestClient();

      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Do something" }],
        tools: [weatherTool, calculatorTool],
        tool_choice: "required",
      });

      const toolCall = response.choices[0].message.tool_calls![0];
      expect(["get_weather", "calculator"]).toContain(toolCall.function.name);
    });

    it("should not return tool calls when tool_choice is none", async () => {
      const client = getTestClient();

      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
        tools: [weatherTool],
        tool_choice: "none",
      });

      expect(response.choices[0].finish_reason).toBe("stop");
      expect(response.choices[0].message.tool_calls).toBeUndefined();
      expect(response.choices[0].message.content).toBeTruthy();
    });
  });

  describe("Advanced Schema Features", () => {
    it("should handle complex nested schemas with formats", async () => {
      const client = getTestClient();

      const complexTool: ChatCompletionTool = {
        type: "function",
        function: {
          name: "create_user",
          description: "Create a new user",
          parameters: {
            type: "object",
            properties: {
              email: { type: "string", format: "email" },
              website: { type: "string", format: "uri" },
              birthDate: { type: "string", format: "date" },
              age: { type: "integer", minimum: 18, maximum: 120 },
              score: {
                type: "number",
                minimum: 0,
                maximum: 100,
                multipleOf: 0.5,
              },
              role: { type: "string", enum: ["admin", "user", "guest"] },
              tags: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
                maxItems: 5,
              },
              address: {
                type: "object",
                properties: {
                  street: { type: "string" },
                  city: { type: "string" },
                  zipCode: { type: "string", pattern: "^[0-9]{5}$" },
                },
                required: ["city"],
              },
            },
            required: ["email", "role"],
          },
        },
      };

      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Create a user" }],
        tools: [complexTool],
        tool_choice: "required",
      });

      const toolCall = response.choices[0].message.tool_calls![0];
      const args = JSON.parse(toolCall.function.arguments);

      // Required fields should be present
      expect(args).toHaveProperty("email");
      expect(args).toHaveProperty("role");

      // Email should look like an email
      expect(args.email).toMatch(/@/);

      // Role should be from enum
      expect(["admin", "user", "guest"]).toContain(args.role);

      // Age should be within bounds (if present)
      if (args.age !== undefined) {
        expect(args.age).toBeGreaterThanOrEqual(18);
        expect(args.age).toBeLessThanOrEqual(120);
        expect(Number.isInteger(args.age)).toBe(true);
      }

      // Tags should be an array (if present)
      if (args.tags !== undefined) {
        expect(Array.isArray(args.tags)).toBe(true);
        expect(args.tags.length).toBeGreaterThanOrEqual(1);
        expect(args.tags.length).toBeLessThanOrEqual(5);
      }

      // Address should have required city (if present)
      if (args.address !== undefined) {
        expect(args.address).toHaveProperty("city");
      }
    });

    it("should handle oneOf schemas", async () => {
      const client = getTestClient();

      const oneOfTool: ChatCompletionTool = {
        type: "function",
        function: {
          name: "send_message",
          description: "Send a message",
          parameters: {
            type: "object",
            properties: {
              recipient: {
                oneOf: [
                  { type: "string", format: "email" },
                  {
                    type: "object",
                    properties: { userId: { type: "integer" } },
                    required: ["userId"],
                  },
                ],
              },
            },
            required: ["recipient"],
          },
        },
      };

      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Send a message" }],
        tools: [oneOfTool],
        tool_choice: "required",
      });

      const toolCall = response.choices[0].message.tool_calls![0];
      const args = JSON.parse(toolCall.function.arguments);

      // recipient should be either a string or an object with userId
      expect(args).toHaveProperty("recipient");
      const recipient = args.recipient;
      const isString = typeof recipient === "string";
      const isUserIdObject =
        typeof recipient === "object" &&
        recipient !== null &&
        "userId" in recipient;
      expect(isString || isUserIdObject).toBe(true);
    });
  });

  describe("Streaming", () => {
    it("should stream tool calls correctly", async () => {
      const client = getTestClient();

      const stream = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "What's the weather?" }],
        tools: [weatherTool],
        tool_choice: "required",
        stream: true,
      });

      let toolCallId: string | null = null;
      let toolCallName: string | null = null;
      let toolCallArgs = "";
      let hasFinishReason = false;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) {
              toolCallId = tc.id;
            }
            if (tc.function?.name) {
              toolCallName = tc.function.name;
            }
            if (tc.function?.arguments) {
              toolCallArgs += tc.function.arguments;
            }
          }
        }

        if (chunk.choices[0]?.finish_reason === "tool_calls") {
          hasFinishReason = true;
        }
      }

      expect(toolCallId).toMatch(/^call_/);
      expect(toolCallName).toBe("get_weather");
      expect(hasFinishReason).toBe(true);

      // Combined arguments should be valid JSON
      const args = JSON.parse(toolCallArgs);
      expect(args).toHaveProperty("location");
    });
  });
});
