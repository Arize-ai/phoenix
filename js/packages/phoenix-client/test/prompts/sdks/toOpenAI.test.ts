import { describe, it, assertType, expect } from "vitest";
import { toOpenAI } from "../../../src/prompts/sdks/toOpenAI";
import { toSDK } from "../../../src/prompts/sdks/toSDK";
import type OpenAI from "openai";
import { PromptVersion } from "../../../src/types/prompts";
import invariant from "tiny-invariant";
import {
  BASE_MOCK_PROMPT_VERSION,
  BASE_MOCK_PROMPT_VERSION_RESPONSE_FORMAT,
  BASE_MOCK_PROMPT_VERSION_TOOLS,
} from "./data";

type ChatCompletionCreateParams = Parameters<
  typeof OpenAI.prototype.chat.completions.create
>[0];

describe("toOpenAI type compatibility", () => {
  it("toOpenAI output should be assignable to OpenAI chat completion params", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
    } satisfies PromptVersion;

    const result = toOpenAI({ prompt: mockPrompt });

    expect(result).not.toBeNull();
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

    expect(result).not.toBeNull();
    invariant(result, "Expected non-null result");

    assertType<ChatCompletionCreateParams>(result);
  });

  it("should handle tools and response format type compatibility", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
      ...BASE_MOCK_PROMPT_VERSION_TOOLS,
      ...BASE_MOCK_PROMPT_VERSION_RESPONSE_FORMAT,
    } satisfies PromptVersion;

    const result = toSDK({
      sdk: "openai",
      prompt: mockPrompt,
    });

    expect(result).not.toBeNull();
    invariant(result, "Expected non-null result");

    assertType<ChatCompletionCreateParams>(result);
  });

  it("should handle typed variables", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
    };

    // variables are still inferred, as normal
    // no type error occurs as long as variable is stringable
    toOpenAI({
      prompt: mockPrompt,
      variables: {
        question: true,
        answer: 42,
      },
    });

    // using toOpenAI should take a single generic argument
    toOpenAI<{ question: number }>({
      prompt: mockPrompt,
      variables: {
        question: 1,
      },
    });

    // using toSDK should take two generic arguments
    toSDK<"openai", { question: number }>({
      sdk: "openai",
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
        tool_choice: { type: "zero-or-more" },
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
      response_format: {
        type: "response-format-json-schema-v1",
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
      template: {
        version: "chat-template-v1",
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

    const result = toSDK({
      sdk: "openai",
      prompt: mockPrompt,
    });

    expect(result).not.toBeNull();
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
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "test",
          description: "test function",
          schema: {
            type: "object",
            properties: {},
          },
        },
      },
      temperature: 0.7,
      tool_choice: "auto",
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
