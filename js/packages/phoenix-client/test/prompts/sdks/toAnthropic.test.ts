import { describe, it, assertType, expect } from "vitest";
import { toSDK } from "../../../src/prompts/sdks/toSDK";
import { PromptVersion } from "../../../src/types/prompts";
import invariant from "tiny-invariant";
import type { MessageCreateParams } from "@anthropic-ai/sdk/resources";
import { toAnthropic } from "../../../src/prompts/sdks/toAnthropic";

const BASE_MOCK_PROMPT_VERSION = {
  id: "test",
  description: "Test prompt",
  model_provider: "openai",
  model_name: "gpt-4",
  template_type: "CHAT",
  template_format: "MUSTACHE",
  template: {
    version: "chat-template-v1",
    messages: [
      {
        role: "USER",
        content: [{ type: "text", text: { text: "Hello" } }],
      },
    ],
  },
  invocation_parameters: {
    temperature: 0.7,
    tool_choice: "auto",
  },
} satisfies Partial<PromptVersion>;

describe("toAnthropic type compatibility", () => {
  it("toAnthropic output should be assignable to Anthropic message params", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
    } satisfies PromptVersion;

    const result = toAnthropic({ prompt: mockPrompt });

    expect(result).toBeDefined();
    invariant(result, "Expected non-null result");

    assertType<MessageCreateParams>(result);
  });

  it("toSDK with anthropic should be assignable to Anthropic message params", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
    };

    const result = toSDK({
      sdk: "anthropic",
      prompt: mockPrompt,
    });

    expect(result).toBeDefined();
    invariant(result, "Expected non-null result");

    assertType<MessageCreateParams>(result);
  });

  it("should handle tools and response format type compatibility", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
      tools: {
        type: "tools-v1",
        tools: [
          {
            type: "function-tool-v1",
            name: "test",
            description: "test function",
            schema: {
              type: "json-schema-draft-7-object-schema",
              json: {
                type: "object",
                properties: {},
              },
            },
          },
        ],
      },
      output_schema: {
        type: "output-schema-v1",
        name: "test",
        description: "test function",
        schema: {
          type: "json-schema-draft-7-object-schema",
          json: {
            type: "object",
            properties: {},
          },
        },
        extra_parameters: {},
      },
      invocation_parameters: {
        temperature: 0.7,
        tool_choice: "auto",
      },
    } satisfies PromptVersion;

    const result = toSDK({
      sdk: "anthropic",
      prompt: mockPrompt,
    });

    expect(result).toBeDefined();
    invariant(result, "Expected non-null result");

    assertType<MessageCreateParams>(result);
  });

  it("should handle typed variables", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
    };

    // variables are still inferred, as normal
    // no type error occurs as long as variable is stringable
    toAnthropic({
      prompt: mockPrompt,
      variables: {
        question: true,
        answer: 42,
      },
    });

    // using toOpenAI should take a single generic argument
    toAnthropic<{ question: number }>({
      prompt: mockPrompt,
      variables: {
        question: 1,
      },
    });

    // using toSDK should take two generic arguments
    toSDK<"anthropic", { question: number }>({
      sdk: "anthropic",
      prompt: mockPrompt,
      variables: {
        question: 1,
      },
    });

    // This test just checks that the types are compatible
    // it will fail in pnpm type:check if the types break in the future
  });

  it("should handle complex message types", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
      tools: {
        type: "tools-v1",
        tools: [
          {
            type: "function-tool-v1",
            name: "edit_image",
            description: "edit an image",
            schema: {
              type: "json-schema-draft-7-object-schema",
              json: {
                type: "object",
                properties: {
                  image_url: {
                    type: "string",
                    description: "the url of the image to edit",
                  },
                  edit_type: {
                    type: "string",
                    description: "the type of edit to perform",
                  },
                },
              },
            },
          },
        ],
      },
      template: {
        version: "chat-template-v1",
        messages: [
          {
            role: "USER",
            content: [
              { type: "text", text: { text: "Can you edit this image?" } },
              {
                type: "image",
                image: {
                  // Anthropic only supports base64 images
                  // if this is any other url, image parts will be dropped
                  url: "data:image/jpeg;base64,test.jpg",
                },
              },
            ],
          },
          {
            role: "AI",
            content: [
              { type: "text", text: { text: "Yes I can edit this image" } },
              {
                type: "tool_call",
                tool_call: {
                  tool_call_id: "123",
                  tool_call: {
                    type: "function",
                    name: "edit_image",
                    arguments: JSON.stringify({
                      image_url: "test.jpg",
                      edit_type: "blur",
                    }),
                  },
                },
              },
            ],
          },
          {
            role: "TOOL",
            content: [
              {
                type: "tool_result",
                tool_result: {
                  tool_call_id: "123",
                  result: JSON.stringify({
                    new_image_url: "test_edited.jpg",
                  }),
                },
              },
            ],
          },
        ],
      },
    } satisfies PromptVersion;

    const result = toSDK({
      sdk: "anthropic",
      prompt: mockPrompt,
    });

    expect(result).toBeDefined();
    invariant(result, "Expected non-null result");

    assertType<MessageCreateParams>(result);

    expect(result).toStrictEqual({
      messages: [
        {
          content: [
            {
              text: "Can you edit this image?",
              type: "text",
            },
            {
              source: {
                data: "data:image/jpeg;base64,test.jpg",
                media_type: "image/jpeg",
                type: "base64",
              },
              type: "image",
            },
          ],
          role: "user",
        },
        {
          content: [
            {
              text: "Yes I can edit this image",
              type: "text",
            },
            {
              id: "123",
              input: '{"image_url":"test.jpg","edit_type":"blur"}',
              name: "edit_image",
              type: "tool_use",
            },
          ],
          role: "assistant",
        },
        {
          content: [
            {
              content: '{"new_image_url":"test_edited.jpg"}',
              tool_use_id: "123",
              type: "tool_result",
            },
          ],
          role: "user",
        },
      ],
      model: "gpt-4",
      temperature: 0.7,
      tool_choice: {
        type: "auto",
      },
      tools: [
        {
          description: "edit an image",
          input_schema: {
            properties: {
              edit_type: {
                description: "the type of edit to perform",
                type: "string",
              },
              image_url: {
                description: "the url of the image to edit",
                type: "string",
              },
            },
            type: "object",
          },
          name: "edit_image",
        },
      ],
    });
  });
});
