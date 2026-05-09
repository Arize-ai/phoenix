import {
  anthropicToolDefinitionSchema,
  awsToolDefinitionSchema,
  geminiToolDefinitionSchema,
  openAIChatCompletionsToolDefinitionSchema,
  openAIResponsesToolDefinitionSchema,
} from "../toolSchemas";
import {
  getTestAnthropicToolDefinition,
  getTestAwsToolDefinition,
  getTestGeminiToolDefinition,
  getTestOpenAIToolDefinition,
} from "./fixtures";

describe("toolSchemas", () => {
  describe("openAIChatCompletionsToolDefinitionSchema", () => {
    it("should parse a valid OpenAI tool definition", () => {
      const tool = getTestOpenAIToolDefinition();
      expect(
        openAIChatCompletionsToolDefinitionSchema.safeParse(tool).success
      ).toBe(true);
    });

    it("should parse OpenAI tool with empty parameters (span/sdk shape)", () => {
      const tool = {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather",
          parameters: {},
        },
      };
      const result = openAIChatCompletionsToolDefinitionSchema.safeParse(tool);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.function.parameters).toEqual({});
      }
    });

    it("should reject unknown OpenAI wrapper fields", () => {
      const tool = {
        type: "function",
        ignored: true,
        function: {
          name: "get_weather",
          description: "Get weather",
          ignored: true,
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                pattern: "^[a-z]+$",
              },
            },
            required: ["location"],
          },
          strict: false,
        },
      };

      expect(
        openAIChatCompletionsToolDefinitionSchema.safeParse(tool).success
      ).toBe(false);
    });

    it("should preserve unknown JSON schema fields", () => {
      const tool = {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                pattern: "^[a-z]+$",
              },
            },
            required: ["location"],
          },
          strict: false,
        },
      };

      const result = openAIChatCompletionsToolDefinitionSchema.safeParse(tool);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.function.strict).toBe(false);
        expect(
          result.data.function.parameters.properties?.location?.pattern
        ).toBe("^[a-z]+$");
      }
    });
  });

  describe("openAIResponsesToolDefinitionSchema", () => {
    it("should reject unknown OpenAI Responses wrapper fields", () => {
      const tool = {
        type: "function",
        name: "get_weather",
        description: "Get weather",
        parameters: {},
        strict: false,
        ignored: true,
      };

      const result = openAIResponsesToolDefinitionSchema.safeParse(tool);
      expect(result.success).toBe(false);
    });
  });

  describe("anthropicToolDefinitionSchema", () => {
    it("should parse a valid Anthropic tool definition", () => {
      const tool = getTestAnthropicToolDefinition();
      expect(anthropicToolDefinitionSchema.safeParse(tool).success).toBe(true);
    });

    it("should parse Anthropic tool with empty input_schema", () => {
      const tool = {
        name: "get_weather",
        description: "Get weather",
        input_schema: {},
      };
      const result = anthropicToolDefinitionSchema.safeParse(tool);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.input_schema).toEqual({});
      }
    });

    it("should reject Anthropic hosted tools without input_schema", () => {
      const tool = {
        type: "web_search_20250305",
        name: "web_search",
      };
      expect(anthropicToolDefinitionSchema.safeParse(tool).success).toBe(false);
    });
  });

  describe("geminiToolDefinitionSchema", () => {
    it("should parse a valid Gemini tool definition", () => {
      const tool = getTestGeminiToolDefinition();
      expect(geminiToolDefinitionSchema.safeParse(tool).success).toBe(true);
    });

    it("should parse Gemini tool with empty parameters", () => {
      const tool = {
        name: "get_weather",
        description: "Get weather",
        parameters: {},
      };
      const result = geminiToolDefinitionSchema.safeParse(tool);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.parameters).toEqual({});
      }
    });

    it("should parse Gemini tool with parameters_json_schema (Google SDK shape)", () => {
      const tool = {
        name: "get_weather",
        description: "Get weather",
        parameters_json_schema: {
          type: "object",
          properties: { location: { type: "string" } },
          required: ["location"],
        },
      };
      expect(geminiToolDefinitionSchema.safeParse(tool).success).toBe(true);
    });
  });

  describe("awsToolDefinitionSchema", () => {
    it("should parse a valid AWS tool definition", () => {
      const tool = getTestAwsToolDefinition();
      expect(awsToolDefinitionSchema.safeParse(tool).success).toBe(true);
    });

    it("should parse AWS tool with empty inputSchema.json (normalizes to type: object)", () => {
      const tool = {
        toolSpec: {
          name: "get_weather",
          description: "Get weather",
          inputSchema: { json: {} },
        },
      };
      const result = awsToolDefinitionSchema.safeParse(tool);
      expect(result.success).toBe(true);
      if (result.success && "toolSpec" in result.data) {
        expect(result.data.toolSpec.inputSchema.json).toEqual({
          type: "object",
        });
      }
    });

    it("should parse an unwrapped AWS tool definition (without toolSpec)", () => {
      const tool = {
        name: "get_weather",
        description: "Get weather",
        inputSchema: {
          json: {
            type: "object",
            properties: { city: { type: "string" } },
            required: ["city"],
          },
        },
      };
      const result = awsToolDefinitionSchema.safeParse(tool);
      expect(result.success).toBe(true);
      if (result.success && !("toolSpec" in result.data)) {
        expect(result.data.inputSchema.json).toEqual({
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        });
      }
    });
  });
});
