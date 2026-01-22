import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer, stopServer, getBaseUrl } from "./setup";

describe("Responses API", () => {
  beforeAll(async () => {
    await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });

  describe("Non-streaming", () => {
    it("should return a valid response", async () => {
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          input: "Hello, how are you?",
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.id).toMatch(/^resp_/);
      expect(data.object).toBe("response");
      expect(data.model).toBe("gpt-4o");
      expect(data.status).toBe("completed");
      expect(data.output).toBeInstanceOf(Array);
      expect(data.output.length).toBeGreaterThan(0);

      const outputItem = data.output[0];
      expect(outputItem.type).toBe("message");
      expect(outputItem.status).toBe("completed");
      expect(outputItem.role).toBe("assistant");
      expect(outputItem.content).toBeInstanceOf(Array);
      expect(outputItem.content[0].type).toBe("output_text");
      expect(outputItem.content[0].text).toBeTruthy();

      expect(data.usage).toBeDefined();
      expect(data.usage.input_tokens).toBeGreaterThan(0);
      expect(data.usage.output_tokens).toBeGreaterThan(0);
    });

    it("should handle input as array of messages", async () => {
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          input: [
            {
              type: "message",
              role: "user",
              content: "What is 2+2?",
            },
          ],
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.status).toBe("completed");
      expect(data.output[0].content[0].text).toBeTruthy();
    });

    it("should reject requests without model", async () => {
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({
          input: "Hello",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe("missing_required_parameter");
    });
  });

  describe("Tool calls", () => {
    const weatherTool = {
      type: "function",
      function: {
        name: "get_weather",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string" },
            unit: { type: "string", enum: ["celsius", "fahrenheit"] },
          },
          required: ["location"],
        },
      },
    };

    it("should return a function call when tools are provided", async () => {
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          input: "What's the weather?",
          tools: [weatherTool],
          tool_choice: "required",
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.status).toBe("completed");
      expect(data.output[0].type).toBe("function_call");
      expect(data.output[0].name).toBe("get_weather");
      expect(data.output[0].call_id).toMatch(/^call_/);

      // Arguments should be valid JSON
      const args = JSON.parse(data.output[0].arguments);
      expect(args).toHaveProperty("location");
    });
  });

  describe("Streaming", () => {
    it("should stream a valid response", async () => {
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          input: "Hello!",
          stream: true,
        }),
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get("content-type")).toContain(
        "text/event-stream",
      );

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      const events: { type: string; data: unknown }[] = [];
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          const text = decoder.decode(value);
          const lines = text.split("\n");

          let currentEvent: { type?: string; data?: string } = {};
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent.type = line.slice(7);
            } else if (line.startsWith("data: ")) {
              currentEvent.data = line.slice(6);
              if (currentEvent.type && currentEvent.data) {
                events.push({
                  type: currentEvent.type,
                  data: JSON.parse(currentEvent.data),
                });
                currentEvent = {};
              }
            }
          }
        }
      }

      // Check for expected event types
      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain("response.created");
      expect(eventTypes).toContain("response.in_progress");
      expect(eventTypes).toContain("response.output_item.added");
      expect(eventTypes).toContain("response.output_text.delta");
      expect(eventTypes).toContain("response.output_text.done");
      expect(eventTypes).toContain("response.output_item.done");
      expect(eventTypes).toContain("response.completed");

      // Check that we got text deltas
      const textDeltas = events.filter(
        (e) => e.type === "response.output_text.delta",
      );
      expect(textDeltas.length).toBeGreaterThan(0);

      // Check completed event
      const completedEvent = events.find(
        (e) => e.type === "response.completed",
      );
      expect(
        (completedEvent?.data as { response: { status: string } }).response
          .status,
      ).toBe("completed");
    });

    it("should stream function call arguments", async () => {
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          input: "What's the weather?",
          tools: [
            {
              type: "function",
              function: {
                name: "get_weather",
                parameters: {
                  type: "object",
                  properties: {
                    location: { type: "string" },
                  },
                  required: ["location"],
                },
              },
            },
          ],
          tool_choice: "required",
          stream: true,
        }),
      });

      expect(response.ok).toBe(true);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      const events: { type: string; data: unknown }[] = [];
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          const text = decoder.decode(value);
          const lines = text.split("\n");

          let currentEvent: { type?: string; data?: string } = {};
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent.type = line.slice(7);
            } else if (line.startsWith("data: ")) {
              currentEvent.data = line.slice(6);
              if (currentEvent.type && currentEvent.data) {
                events.push({
                  type: currentEvent.type,
                  data: JSON.parse(currentEvent.data),
                });
                currentEvent = {};
              }
            }
          }
        }
      }

      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain("response.function_call_arguments.delta");
      expect(eventTypes).toContain("response.function_call_arguments.done");

      // Check the done event has valid arguments
      const argsDoneEvent = events.find(
        (e) => e.type === "response.function_call_arguments.done",
      ) as { type: string; data: { arguments: string } } | undefined;
      expect(argsDoneEvent).toBeDefined();

      const args = JSON.parse(argsDoneEvent!.data.arguments);
      expect(args).toHaveProperty("location");
    });
  });
});
