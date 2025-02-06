import { describe, it, assertType, expect } from "vitest";
import { toOpenAI } from "../../../src/prompts/sdks/toOpenAI";
import { toSDK } from "../../../src/prompts/sdks/toSDK";
import type OpenAI from "openai";
import { PromptVersion } from "../../../src/types/prompts";
import invariant from "tiny-invariant";

const BASE_MOCK_PROMPT_VERSION = {
  id: "test",
  description: "Test prompt",
  model_provider: "openai",
  model_name: "gpt-4",
  template_type: "CHAT",
  template_format: "MUSTACHE",
  template: {
    messages: [
      {
        role: "USER",
        content: [{ type: "text", text: { text: "Hello" } }],
      },
    ],
  },
  invocation_parameters: {
    temperature: 0.7,
  },
} satisfies Partial<PromptVersion>;

type ChatCompletionCreateParams = Parameters<
  typeof OpenAI.prototype.chat.completions.create
>[0];

describe("toOpenAI type compatibility", () => {
  it("toOpenAI output should be assignable to OpenAI chat completion params", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
    } satisfies PromptVersion;

    const result = toOpenAI({ prompt: mockPrompt });

    expect(result).toBeDefined();
    invariant(result, "Expected non-null result");

    assertType<ChatCompletionCreateParams>(result);
  });

  it("toSDK with openai should be assignable to OpenAI chat completion params", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
    };

    const result = toSDK({
      sdk: "openai",
      prompt: mockPrompt,
    });

    expect(result).toBeDefined();
    invariant(result, "Expected non-null result");

    assertType<ChatCompletionCreateParams>(result);
  });

  it("should handle tools and response format type compatibility", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
      tools: {
        version: "tools-v1",
        tool_definitions: [
          {
            definition: {
              type: "function",
              function: {
                name: "test",
                description: "test function",
                parameters: {
                  type: "object",
                  properties: {},
                },
              },
            },
          },
        ],
      },
      output_schema: {
        definition: {
          type: "json_object",
        },
      },
      invocation_parameters: {
        temperature: 0.7,
        tool_choice: "auto",
      },
    } satisfies PromptVersion;

    const result = toSDK({
      sdk: "openai",
      prompt: mockPrompt,
    });

    expect(result).toBeDefined();
    invariant(result, "Expected non-null result");

    assertType<ChatCompletionCreateParams>(result);
  });

  it("should handle complex message types", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
      tools: {
        version: "tools-v1",
        tool_definitions: [
          {
            definition: {
              type: "function",
              function: {
                name: "edit_image",
                description: "edit an image",
                parameters: {
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
          },
        ],
      },
      template: {
        messages: [
          {
            role: "USER",
            content: [
              { type: "text", text: { text: "Can you edit this image?" } },
              { type: "image", image: { url: "test.jpg" } },
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

    const result = toOpenAI({ prompt: mockPrompt });

    expect(result).toBeDefined();
    invariant(result, "Expected non-null result");

    assertType<ChatCompletionCreateParams>(result);

    expect(result).toStrictEqual({
      messages: [
        {
          content: [
            {
              text: "Can you edit this image?",
              type: "text",
            },
            {
              image_url: {
                url: "test.jpg",
              },
              type: "image_url",
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
          ],
          role: "assistant",
          tool_calls: [
            {
              function: {
                name: "edit_image",
                arguments: '{"image_url":"test.jpg","edit_type":"blur"}',
              },
              type: "function",
              id: "123",
            },
          ],
        },
        {
          content: '{"new_image_url":"test_edited.jpg"}',
          role: "tool",
          tool_call_id: "123",
        },
      ],
      model: "gpt-4",
      response_format: undefined,
      temperature: 0.7,
      tool_choice: undefined,
      tools: [
        {
          type: "function",
          function: {
            name: "edit_image",
            description: "edit an image",
            parameters: {
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
    });
  });
});
