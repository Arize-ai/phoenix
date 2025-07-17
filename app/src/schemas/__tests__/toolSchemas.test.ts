import {
  anthropicToolDefinitionSchema,
  createAnthropicToolDefinition,
  createOpenAIToolDefinition,
  detectToolDefinitionProvider,
  fromOpenAIToolDefinition,
  openAIToolDefinitionSchema,
  toOpenAIToolDefinition,
} from "../toolSchemas";

import {
  getTestAnthropicToolDefinition,
  getTestOpenAIToolDefinition,
} from "./fixtures";

describe("toolSchemas", () => {
  describe("detectToolDefinitionProvider", () => {
    it("should detect OpenAI tool definition", () => {
      const openAITool = getTestOpenAIToolDefinition();
      const result = detectToolDefinitionProvider(openAITool);
      expect(result.provider).toBe("OPENAI");
      expect(result.validatedToolDefinition).toEqual(openAITool);
    });

    it("should detect Anthropic tool definition", () => {
      const anthropicTool = getTestAnthropicToolDefinition();
      const result = detectToolDefinitionProvider(anthropicTool);
      expect(result.provider).toBe("ANTHROPIC");
      expect(result.validatedToolDefinition).toEqual(anthropicTool);
    });

    it("should return unknown provider for unknown tool definition", () => {
      const unknownTool = { name: "test_name", input_schema: {} };
      const result = detectToolDefinitionProvider(unknownTool);
      expect(result.provider).toBe("UNKNOWN");
      expect(result.validatedToolDefinition).toBeNull();
    });
  });

  describe("toOpenAIToolDefinition", () => {
    it("should convert Anthropic tool definition to OpenAI format", () => {
      const anthropicTool = getTestAnthropicToolDefinition({
        name: "anthropic_test",
        description: "test",
        input_schema: {
          type: "object",
          properties: {
            test: {
              type: "string",
            },
          },
          required: ["test"],
        },
      });
      const openAITool = toOpenAIToolDefinition(anthropicTool);
      expect(openAITool).not.toBeNull();
      if (!openAITool) {
        throw new Error("OpenAI tool definition is null");
      }
      expect(openAITool.function.name).toBe(anthropicTool.name);
      expect(openAITool.function.description).toBe(anthropicTool.description);
      expect(openAITool.function.parameters).toEqual(
        anthropicTool.input_schema
      );
    });

    it("should return OpenAI tool definition as is", () => {
      const openAITool = getTestOpenAIToolDefinition();
      const result = toOpenAIToolDefinition(openAITool);
      expect(result).toEqual(openAITool);
    });

    it("should return null if the provider is unknown", () => {
      const unknownTool = { name: "test_name", input_schema: {} };
      const result = toOpenAIToolDefinition(unknownTool);
      expect(result).toBeNull();
    });
  });

  describe("fromOpenAIToolDefinition", () => {
    it("should convert OpenAI tool definition to Anthropic format", () => {
      const openAITool = getTestOpenAIToolDefinition({
        name: "openai_test",
        function: {
          name: "openai_test",
          description: "test",
          parameters: {
            type: "object",
            properties: {
              test: {
                type: "string",
              },
            },
            required: ["test"],
          },
        },
      });
      const anthropicTool = fromOpenAIToolDefinition({
        toolDefinition: openAITool,
        targetProvider: "ANTHROPIC",
      });
      expect(anthropicTool.name).toBe(openAITool.function.name);
      expect(anthropicTool.description).toBe(openAITool.function.description);
      expect(anthropicTool.input_schema).toEqual(
        openAITool.function.parameters
      );
    });

    it("should return OpenAI tool definition as is for OpenAI target", () => {
      const openAITool = getTestOpenAIToolDefinition();
      const result = fromOpenAIToolDefinition({
        toolDefinition: openAITool,
        targetProvider: "OPENAI",
      });
      expect(result).toEqual(openAITool);
    });
  });

  describe("createOpenAIToolDefinition", () => {
    it("should create a valid OpenAI tool definition", () => {
      const toolNumber = 1;
      const openAITool = createOpenAIToolDefinition(toolNumber);
      const parsed = openAIToolDefinitionSchema.safeParse(openAITool);
      expect(parsed.success).toBe(true);
      expect(openAITool.function.name).toBe(`new_function_${toolNumber}`);
    });
  });

  describe("createAnthropicToolDefinition", () => {
    it("should create a valid Anthropic tool definition", () => {
      const toolNumber = 1;
      const anthropicTool = createAnthropicToolDefinition(toolNumber);
      const parsed = anthropicToolDefinitionSchema.safeParse(anthropicTool);
      expect(parsed.success).toBe(true);
      expect(anthropicTool.name).toBe(`new_function_${toolNumber}`);
    });
  });
});
