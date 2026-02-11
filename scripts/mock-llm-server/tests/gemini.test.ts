import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer, stopServer, getBaseUrl } from "./setup";
import { GoogleGenAI } from "@google/genai";

function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: false,
    apiKey: "test-key",
    httpOptions: {
      baseUrl: getBaseUrl(),
    },
  });
}

describe("Google GenAI (Gemini) API", () => {
  beforeAll(async () => {
    await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });

  describe("Non-streaming", () => {
    it("should return a valid generateContent response", async () => {
      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: "Hello!",
      });

      expect(response.responseId).toBeDefined();
      expect(response.modelVersion).toBe("gemini-2.0-flash");
      expect(response.candidates).toHaveLength(1);
      expect(response.candidates![0].content.role).toBe("model");
      expect(response.candidates![0].content.parts).toHaveLength(1);
      expect(response.text).toBeTruthy();
      expect(response.usageMetadata).toBeDefined();
      expect(response.usageMetadata!.promptTokenCount).toBeGreaterThan(0);
      expect(response.usageMetadata!.candidatesTokenCount).toBeGreaterThan(0);
    });

    it("should handle multiple messages", async () => {
      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          { role: "user", parts: [{ text: "Hello!" }] },
          { role: "model", parts: [{ text: "Hi there!" }] },
          { role: "user", parts: [{ text: "How are you?" }] },
        ],
      });

      expect(response.text).toBeTruthy();
    });

    it("should handle system instruction", async () => {
      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: "Hello!",
        config: {
          systemInstruction: "You are a helpful assistant.",
        },
      });

      expect(response.text).toBeTruthy();
    });

    it("should reject requests without contents", async () => {
      const response = await fetch(
        `${getBaseUrl()}/v1beta/models/gemini-2.0-flash:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": "test-key",
          },
          body: JSON.stringify({}),
        },
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.status).toBe("INVALID_ARGUMENT");
    });
  });

  describe("Streaming", () => {
    it("should stream a valid generateContent response", async () => {
      const ai = getGeminiClient();

      const response = await ai.models.generateContentStream({
        model: "gemini-2.0-flash",
        contents: "Hello!",
      });

      const chunks: string[] = [];
      let hasFinishReason = false;

      for await (const chunk of response) {
        if (chunk.text) {
          chunks.push(chunk.text);
        }
        if (chunk.candidates?.[0]?.finishReason === "STOP") {
          hasFinishReason = true;
        }
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(hasFinishReason).toBe(true);

      const fullContent = chunks.join("");
      expect(fullContent).toBeTruthy();
      expect(fullContent.length).toBeGreaterThan(10);
    });

    it("should include usage metadata in streaming response", async () => {
      const ai = getGeminiClient();

      const response = await ai.models.generateContentStream({
        model: "gemini-2.0-flash",
        contents: "Hello!",
      });

      let hasUsage = false;

      for await (const chunk of response) {
        if (chunk.usageMetadata) {
          hasUsage = true;
          expect(chunk.usageMetadata.promptTokenCount).toBeGreaterThan(0);
        }
      }

      expect(hasUsage).toBe(true);
    });
  });

  describe("Function Calling", () => {
    it("should return function call in non-streaming mode", async () => {
      // Start server with 100% tool call probability
      await stopServer();
      await startServer({ TOOL_CALL_PROBABILITY: "1.0" });

      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: "What's the weather in San Francisco?",
        config: {
          tools: [
            {
              functionDeclarations: [
                {
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
              ],
            },
          ],
        },
      });

      expect(response.functionCalls).toBeDefined();
      expect(response.functionCalls!.length).toBeGreaterThan(0);

      const functionCall = response.functionCalls![0];
      expect(functionCall.name).toBe("get_weather");
      expect(functionCall.args).toBeDefined();
      expect(typeof functionCall.args).toBe("object");
    });

    it("should stream function call correctly", async () => {
      // Ensure we have 100% tool call probability
      await stopServer();
      await startServer({ TOOL_CALL_PROBABILITY: "1.0" });

      const ai = getGeminiClient();

      const response = await ai.models.generateContentStream({
        model: "gemini-2.0-flash",
        contents: "What's the weather?",
        config: {
          tools: [
            {
              functionDeclarations: [
                {
                  name: "get_weather",
                  description: "Get the weather for a location",
                  parameters: {
                    type: "object",
                    properties: {
                      location: { type: "string" },
                    },
                    required: ["location"],
                  },
                },
              ],
            },
          ],
        },
      });

      let hasFunctionCall = false;
      let functionName: string | null = null;

      for await (const chunk of response) {
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          hasFunctionCall = true;
          functionName = chunk.functionCalls[0].name;
        }
      }

      expect(hasFunctionCall).toBe(true);
      expect(functionName).toBe("get_weather");
    });

    it("should respect toolConfig mode NONE", async () => {
      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: "What's the weather?",
        config: {
          tools: [
            {
              functionDeclarations: [
                {
                  name: "get_weather",
                  description: "Get the weather",
                  parameters: {
                    type: "object",
                    properties: {
                      location: { type: "string" },
                    },
                  },
                },
              ],
            },
          ],
          toolConfig: {
            functionCallingConfig: {
              mode: "NONE",
            },
          },
        },
      });

      // Should return text, not function call
      expect(response.text).toBeTruthy();
      expect(response.functionCalls).toBeUndefined();
    });
  });
});
