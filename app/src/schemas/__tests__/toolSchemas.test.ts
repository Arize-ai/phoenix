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
  });

  describe("anthropicToolDefinitionSchema", () => {
    it("should parse a valid Anthropic tool definition", () => {
      const tool = getTestAnthropicToolDefinition();
      expect(anthropicToolDefinitionSchema.safeParse(tool).success).toBe(true);
    });
  });

  describe("geminiToolDefinitionSchema", () => {
    it("should parse a valid Gemini tool definition", () => {
      const tool = getTestGeminiToolDefinition();
      expect(geminiToolDefinitionSchema.safeParse(tool).success).toBe(true);
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
  });
});
