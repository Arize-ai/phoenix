import {
  inferOpenAIApiTypeFromAttributes,
  normalizeSpanInvocationParameters,
} from "../spanInvocationParameterHydration";

describe("normalizeSpanInvocationParameters", () => {
  it("returns an empty record of the requested family for non-object input", () => {
    expect(normalizeSpanInvocationParameters(null, "openai")).toEqual({
      family: "openai",
      parameters: {},
    });
    expect(normalizeSpanInvocationParameters("not-json", "anthropic")).toEqual({
      family: "anthropic",
      parameters: {},
    });
    expect(normalizeSpanInvocationParameters(42, "google_genai")).toEqual({
      family: "google_genai",
      parameters: {},
    });
  });

  it("converts snake_case keys to camelCase across the OpenAI Chat shape", () => {
    expect(
      normalizeSpanInvocationParameters(
        {
          temperature: 0.5,
          max_completion_tokens: 256,
          frequency_penalty: 0.1,
          presence_penalty: 0.2,
          top_p: 0.9,
          seed: 7,
          stop: ["END"],
          reasoning_effort: "high",
        },
        "openai"
      )
    ).toEqual({
      family: "openai",
      parameters: {
        temperature: 0.5,
        maxCompletionTokens: 256,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2,
        topP: 0.9,
        seed: 7,
        stop: ["END"],
        reasoningEffort: "high",
      },
    });
  });

  it("preserves the OpenAI Responses nested reasoning shape", () => {
    expect(
      normalizeSpanInvocationParameters(
        {
          temperature: 0.4,
          max_output_tokens: 1024,
          reasoning: { effort: "minimal" },
        },
        "openai"
      )
    ).toEqual({
      family: "openai",
      parameters: {
        temperature: 0.4,
        maxOutputTokens: 1024,
        reasoning: { effort: "minimal" },
      },
    });
  });

  it("preserves the Anthropic thinking discriminated union", () => {
    expect(
      normalizeSpanInvocationParameters(
        {
          max_tokens: 2048,
          thinking: {
            type: "enabled",
            budget_tokens: 256,
            display: "SUMMARIZED",
          },
        },
        "anthropic"
      )
    ).toEqual({
      family: "anthropic",
      parameters: {
        maxTokens: 2048,
        thinking: {
          type: "enabled",
          budgetTokens: 256,
          display: "SUMMARIZED",
        },
      },
    });
  });

  it("preserves the Google thinkingConfig shape", () => {
    expect(
      normalizeSpanInvocationParameters(
        {
          max_output_tokens: 1024,
          thinking_config: {
            thinking_budget: 100,
            thinking_level: "HIGH",
            include_thoughts: true,
          },
        },
        "google_genai"
      )
    ).toEqual({
      family: "google_genai",
      parameters: {
        maxOutputTokens: 1024,
        thinkingConfig: {
          thinkingBudget: 100,
          thinkingLevel: "HIGH",
          includeThoughts: true,
        },
      },
    });
  });

  it("preserves the AWS Bedrock inferenceConfig shape (already camelCase)", () => {
    expect(
      normalizeSpanInvocationParameters(
        {
          inferenceConfig: {
            maxTokens: 256,
            temperature: 0.7,
            topP: 0.9,
            stopSequences: ["\n"],
          },
        },
        "aws_bedrock"
      )
    ).toEqual({
      family: "aws_bedrock",
      parameters: {
        inferenceConfig: {
          maxTokens: 256,
          temperature: 0.7,
          topP: 0.9,
          stopSequences: ["\n"],
        },
      },
    });
  });

  it("drops malformed values per-field while keeping the rest of the record", () => {
    // Per-field `.catch(undefined)` on each schema field gives partial recovery
    // — a wrong-typed temperature drops just temperature, leaving the rest.
    expect(
      normalizeSpanInvocationParameters(
        {
          temperature: "0.5", // wrong type
          max_completion_tokens: 256,
        },
        "openai"
      )
    ).toEqual({
      family: "openai",
      parameters: { maxCompletionTokens: 256 },
    });
  });

  it("drops a malformed Anthropic thinking discriminator while keeping the rest", () => {
    expect(
      normalizeSpanInvocationParameters(
        {
          max_tokens: 1024,
          thinking: { type: "enabled" }, // missing required budget_tokens
        },
        "anthropic"
      )
    ).toEqual({
      family: "anthropic",
      parameters: { maxTokens: 1024 },
    });
  });

  it("passes unknown keys through untouched (no implicit casing conversion)", () => {
    // The schema only renames keys it explicitly declares; unknown keys flow
    // through as-is so future span params reach the form-store, even though
    // they retain their snake_case names until a spec is added for them.
    expect(
      normalizeSpanInvocationParameters(
        {
          temperature: 0.5,
          custom_provider_extra: "anything",
        },
        "openai"
      )
    ).toEqual({
      family: "openai",
      parameters: {
        temperature: 0.5,
        custom_provider_extra: "anything",
      },
    });
  });
});

describe("inferOpenAIApiTypeFromAttributes", () => {
  describe("RESPONSES-leaning signals", () => {
    it("returns RESPONSES when max_output_tokens is present", () => {
      expect(
        inferOpenAIApiTypeFromAttributes({ max_output_tokens: 1024 })
      ).toBe("RESPONSES");
    });

    it("returns RESPONSES when instructions key is present", () => {
      expect(
        inferOpenAIApiTypeFromAttributes({ instructions: "be helpful" })
      ).toBe("RESPONSES");
    });

    it("returns RESPONSES when previous_response_id is present", () => {
      expect(
        inferOpenAIApiTypeFromAttributes({ previous_response_id: "abc123" })
      ).toBe("RESPONSES");
    });

    it("returns RESPONSES when reasoning is an object without reasoning_effort sibling", () => {
      expect(
        inferOpenAIApiTypeFromAttributes({ reasoning: { effort: "high" } })
      ).toBe("RESPONSES");
    });

    it("does NOT trigger the responses-leaning rule from a flat reasoning_effort key alone", () => {
      expect(
        inferOpenAIApiTypeFromAttributes({ reasoning_effort: "high" })
      ).toBeNull();
    });

    it("treats reasoning + reasoning_effort as a chat-completions reasoning shape, not RESPONSES", () => {
      expect(
        inferOpenAIApiTypeFromAttributes({
          reasoning: { effort: "high" },
          reasoning_effort: "high",
        })
      ).toBeNull();
    });

    it("wins over chat-leaning signals when both are present", () => {
      expect(
        inferOpenAIApiTypeFromAttributes({
          max_output_tokens: 1024,
          max_completion_tokens: 512,
        })
      ).toBe("RESPONSES");
    });
  });

  describe("CHAT_COMPLETIONS-leaning signals", () => {
    it("returns CHAT_COMPLETIONS when max_completion_tokens is present", () => {
      expect(
        inferOpenAIApiTypeFromAttributes({ max_completion_tokens: 512 })
      ).toBe("CHAT_COMPLETIONS");
    });

    it("returns CHAT_COMPLETIONS when stop is present", () => {
      expect(inferOpenAIApiTypeFromAttributes({ stop: ["\n"] })).toBe(
        "CHAT_COMPLETIONS"
      );
    });

    it("returns CHAT_COMPLETIONS when frequency_penalty is present", () => {
      expect(inferOpenAIApiTypeFromAttributes({ frequency_penalty: 0.5 })).toBe(
        "CHAT_COMPLETIONS"
      );
    });

    it("returns CHAT_COMPLETIONS when presence_penalty is present", () => {
      expect(inferOpenAIApiTypeFromAttributes({ presence_penalty: 0.2 })).toBe(
        "CHAT_COMPLETIONS"
      );
    });
  });

  describe("string payloads", () => {
    it("parses a JSON-string payload before classifying", () => {
      expect(
        inferOpenAIApiTypeFromAttributes(
          JSON.stringify({ max_output_tokens: 1024 })
        )
      ).toBe("RESPONSES");
    });

    it("returns null on unparseable JSON strings", () => {
      expect(inferOpenAIApiTypeFromAttributes("{not json")).toBeNull();
    });
  });

  describe("inputs with no API-distinguishing signal", () => {
    it("returns null for an empty object", () => {
      expect(inferOpenAIApiTypeFromAttributes({})).toBeNull();
    });

    it("returns null for generic keys (temperature, top_p) only", () => {
      expect(
        inferOpenAIApiTypeFromAttributes({ temperature: 0.7, top_p: 0.9 })
      ).toBeNull();
    });

    it("returns null for null input", () => {
      expect(inferOpenAIApiTypeFromAttributes(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(inferOpenAIApiTypeFromAttributes(undefined)).toBeNull();
    });

    it("returns null for non-object, non-string scalars", () => {
      expect(inferOpenAIApiTypeFromAttributes(42)).toBeNull();
    });

    it("returns null for arrays", () => {
      expect(inferOpenAIApiTypeFromAttributes([1, 2, 3])).toBeNull();
    });
  });
});
