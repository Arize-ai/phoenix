import {
  anthropicToolCallSchema,
  createAnthropicToolCall,
  createOpenAIToolCall,
  detectToolCallProvider,
  fromOpenAIToolCall,
  openAIToolCallSchema,
  toOpenAIToolCall,
} from "../toolCallSchemas";

import { getTestAnthropicToolCall, getTestOpenAIToolCall } from "./fixtures";

describe("toolCallSchemas", () => {
  describe("detectToolCallProvider", () => {
    it("should detect OpenAI tool call", () => {
      const openAITool = getTestOpenAIToolCall();
      const result = detectToolCallProvider(openAITool);
      expect(result.provider).toBe("OPENAI");
      expect(result.validatedToolCall).toEqual(openAITool);
    });

    it("should detect Anthropic tool call", () => {
      const anthropicToolCall = getTestAnthropicToolCall();
      const result = detectToolCallProvider(anthropicToolCall);
      expect(result.provider).toBe("ANTHROPIC");
      expect(result.validatedToolCall).toEqual(anthropicToolCall);
    });

    it("should return unknown provider for unknown tool call", () => {
      const unknownTool = { id: "test_id", name: "test_name", input: {} };
      const result = detectToolCallProvider(unknownTool);
      expect(result.provider).toBe("UNKNOWN");
      expect(result.validatedToolCall).toBeNull();
    });
  });

  describe("toOpenAIToolCall", () => {
    it("should convert Anthropic tool definition to OpenAI format", () => {
      const anthropicToolCall = getTestAnthropicToolCall({
        id: "test_id",
        name: "test_name",
        input: { test: "test" },
      });
      const openAITool = toOpenAIToolCall(anthropicToolCall);
      expect(openAITool).not.toBeNull();
      if (!openAITool) {
        throw new Error("OpenAI tool call is null");
      }
      expect(openAITool.function.name).toBe(anthropicToolCall.name);
      expect(openAITool.id).toBe(anthropicToolCall.id);
      expect(openAITool.function.arguments).toEqual(anthropicToolCall.input);
    });

    it("should return OpenAI tool definition as is", () => {
      const openAITool = getTestOpenAIToolCall();
      const result = toOpenAIToolCall(openAITool);
      expect(result).toEqual(openAITool);
    });

    it("should return null if the provider is unknown", () => {
      const unknownTool = { id: "test_id", name: "test_name", input: {} };
      const result = toOpenAIToolCall(unknownTool);
      expect(result).toBeNull();
    });
  });

  describe("fromOpenAIToolCall", () => {
    it("should convert OpenAI tool call to Anthropic format", () => {
      const openAIToolCall = getTestOpenAIToolCall({
        id: "test_id",
        function: {
          name: "test_name",
          arguments: { test: "test" },
        },
      });
      const anthropicToolCall = fromOpenAIToolCall({
        toolCall: openAIToolCall,
        targetProvider: "ANTHROPIC",
      });
      expect(anthropicToolCall.name).toBe(openAIToolCall.function.name);
      expect(anthropicToolCall.id).toBe(openAIToolCall.id);
      expect(anthropicToolCall.input).toEqual(
        openAIToolCall.function.arguments
      );
      expect(anthropicToolCall.type).toBe("tool_use");
    });

    it("should return OpenAI tool call as is for OpenAI target", () => {
      const openAITool = getTestOpenAIToolCall();
      const result = fromOpenAIToolCall({
        toolCall: openAITool,
        targetProvider: "OPENAI",
      });
      expect(result).toEqual(openAITool);
    });
  });

  describe("createOpenAIToolCall", () => {
    it("should create a valid OpenAI tool definition", () => {
      const openAITool = createOpenAIToolCall();
      const parsed = openAIToolCallSchema.safeParse(openAITool);
      expect(parsed.success).toBe(true);
    });
  });

  describe("createAnthropicToolCallCall", () => {
    it("should create a valid Anthropic tool definition", () => {
      const anthropicToolCall = createAnthropicToolCall();
      const parsed = anthropicToolCallSchema.safeParse(anthropicToolCall);
      expect(parsed.success).toBe(true);
    });
  });
});
