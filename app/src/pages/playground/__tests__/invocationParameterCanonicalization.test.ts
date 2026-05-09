import { canonicalizeInvocationParameters } from "../invocationParameterCanonicalization";

describe("canonicalizeInvocationParameters", () => {
  describe("OpenAI legacy maxTokens normalization", () => {
    it("renames legacy maxTokens to maxCompletionTokens", () => {
      expect(
        canonicalizeInvocationParameters({
          family: "openai",
          parameters: { maxTokens: 512 },
        })
      ).toEqual({
        family: "openai",
        parameters: { maxCompletionTokens: 512 },
      });
    });

    it("prefers an existing maxCompletionTokens over legacy maxTokens", () => {
      expect(
        canonicalizeInvocationParameters({
          family: "openai",
          parameters: { maxTokens: 128, maxCompletionTokens: 256 },
        })
      ).toEqual({
        family: "openai",
        parameters: { maxCompletionTokens: 256 },
      });
    });
  });

  describe("RESPONSES API maxOutputTokens flattening", () => {
    it("moves maxOutputTokens to maxCompletionTokens when caller declares RESPONSES", () => {
      expect(
        canonicalizeInvocationParameters(
          { family: "openai", parameters: { maxOutputTokens: 1024 } },
          { openaiApiType: "RESPONSES" }
        )
      ).toEqual({
        family: "openai",
        parameters: { maxCompletionTokens: 1024 },
      });
    });

    it("does not overwrite an existing maxCompletionTokens with maxOutputTokens", () => {
      expect(
        canonicalizeInvocationParameters(
          {
            family: "openai",
            parameters: { maxOutputTokens: 1024, maxCompletionTokens: 512 },
          },
          { openaiApiType: "RESPONSES" }
        )
      ).toEqual({
        family: "openai",
        parameters: { maxCompletionTokens: 512 },
      });
    });

    it("drops maxOutputTokens for CHAT_COMPLETIONS (raw-only field, never reaches canonical)", () => {
      expect(
        canonicalizeInvocationParameters(
          { family: "openai", parameters: { maxOutputTokens: 1024 } },
          { openaiApiType: "CHAT_COMPLETIONS" }
        )
      ).toEqual({ family: "openai", parameters: {} });
    });
  });

  describe("RESPONSES API reasoning.effort flattening", () => {
    it("flattens nested reasoning.effort into reasoningEffort", () => {
      expect(
        canonicalizeInvocationParameters(
          {
            family: "openai",
            parameters: { reasoning: { effort: "high" } },
          },
          { openaiApiType: "RESPONSES" }
        )
      ).toEqual({
        family: "openai",
        parameters: { reasoningEffort: "high" },
      });
    });

    it("does not overwrite an existing reasoningEffort", () => {
      expect(
        canonicalizeInvocationParameters(
          {
            family: "openai",
            parameters: {
              reasoning: { effort: "high" },
              reasoningEffort: "low",
            },
          },
          { openaiApiType: "RESPONSES" }
        )
      ).toEqual({
        family: "openai",
        parameters: { reasoningEffort: "low" },
      });
    });

    it("drops nested reasoning for CHAT_COMPLETIONS (raw-only field)", () => {
      expect(
        canonicalizeInvocationParameters(
          {
            family: "openai",
            parameters: { reasoning: { effort: "high" } },
          },
          { openaiApiType: "CHAT_COMPLETIONS" }
        )
      ).toEqual({ family: "openai", parameters: {} });
    });

    it("drops nested reasoning when openaiApiType is unspecified (raw-only field)", () => {
      expect(
        canonicalizeInvocationParameters({
          family: "openai",
          parameters: { reasoning: { effort: "high" } },
        })
      ).toEqual({ family: "openai", parameters: {} });
    });
  });

  describe("non-OpenAI providers", () => {
    it("does not apply OpenAI canonicalization for Anthropic", () => {
      expect(
        canonicalizeInvocationParameters({
          family: "anthropic",
          parameters: { maxTokens: 512 },
        })
      ).toEqual({
        family: "anthropic",
        parameters: { maxTokens: 512 },
      });
    });

    it("expands AWS Bedrock inferenceConfig nested keys onto flat keys", () => {
      expect(
        canonicalizeInvocationParameters({
          family: "aws_bedrock",
          parameters: {
            inferenceConfig: {
              maxTokens: 256,
              temperature: 0.7,
              topP: 0.9,
              stopSequences: ["\n"],
            },
          },
        })
      ).toEqual({
        family: "aws_bedrock",
        parameters: {
          // inferenceConfig has been lifted to top-level keys and dropped —
          // canonical AWS is flat-only.
          maxTokens: 256,
          temperature: 0.7,
          topP: 0.9,
          stopSequences: ["\n"],
        },
      });
    });
  });
});
