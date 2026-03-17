import {
  anthropicToolDefinitionSchema,
  awsToolDefinitionSchema,
  geminiToolDefinitionSchema,
  openAIToolDefinitionSchema,
} from "../toolSchemas";
import {
  getTestAnthropicToolDefinition,
  getTestAwsToolDefinition,
  getTestGeminiToolDefinition,
  getTestOpenAIToolDefinition,
} from "./fixtures";

describe("toolSchemas", () => {
  describe("openAIToolDefinitionSchema", () => {
    it("should parse a valid OpenAI tool definition", () => {
      const tool = getTestOpenAIToolDefinition();
      expect(openAIToolDefinitionSchema.safeParse(tool).success).toBe(true);
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
      const result = openAIToolDefinitionSchema.safeParse(tool);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.function.parameters).toEqual({});
      }
    });
  });

  describe("anthropicToolDefinitionSchema", () => {
    it("should parse a valid Anthropic tool definition", () => {
      const tool = getTestAnthropicToolDefinition();
      expect(anthropicToolDefinitionSchema.safeParse(tool).success).toBe(true);
    });

    it("should parse Anthropic tool with empty input_schema (normalizes to type: object)", () => {
      const tool = {
        name: "get_weather",
        description: "Get weather",
        input_schema: {},
      };
      const result = anthropicToolDefinitionSchema.safeParse(tool);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.input_schema).toEqual({ type: "object" });
      }
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
      if (result.success) {
        expect(result.data.toolSpec.inputSchema.json).toEqual({
          type: "object",
        });
      }
    });
  });
});
