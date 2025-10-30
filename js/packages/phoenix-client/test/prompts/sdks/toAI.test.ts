import { type PartialAIParams, toAI } from "../../../src/prompts/sdks/toAI";
import { toSDK } from "../../../src/prompts/sdks/toSDK";
import { PromptVersion } from "../../../src/types/prompts";

import { BASE_MOCK_PROMPT_VERSION } from "./data";

import { openai } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import invariant from "tiny-invariant";
import {
  afterEach,
  assertType,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

describe("toAI type compatibility", () => {
  beforeEach(() => {
    // replace calls to openai with a mock
    vi.mock("@ai-sdk/openai", () => ({
      openai: vi.fn(),
    }));

    // replace calls to streamText, generateText, streamObject, and generateObject with a mock
    vi.mock(import("ai"), async (importOriginal) => {
      const mod = await importOriginal();
      return {
        ...mod,
        streamText: vi.fn(),
        generateText: vi.fn(),
        streamObject: vi.fn(),
        generateObject: vi.fn(),
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("toAI output should be assignable to AI message params", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
    } satisfies PromptVersion;

    const result = toAI({ prompt: mockPrompt });

    expect(result).not.toBeNull();
    invariant(result, "Expected non-null result");

    assertType<PartialAIParams>(result);
  });

  it("toSDK with ai should be assignable to AI message params", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
    } satisfies PromptVersion;

    const result = toSDK({
      sdk: "ai",
      prompt: mockPrompt,
    });

    expect(result).not.toBeNull();
    invariant(result, "Expected non-null result");

    assertType<PartialAIParams>(result);
  });

  it("should handle typed variables", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
    };

    // variables are still inferred, as normal
    // no type error occurs as long as variable is stringable
    toAI({
      prompt: mockPrompt,
      variables: {
        question: true,
        answer: 42,
      },
    });

    // using toOpenAI should take a single generic argument
    toAI<{ question: number }>({
      prompt: mockPrompt,
      variables: {
        question: 1,
      },
    });

    // using toSDK should take two generic arguments
    toSDK<"ai", { question: number }>({
      sdk: "ai",
      prompt: mockPrompt,
      variables: {
        question: 1,
      },
    });

    // This test just checks that the types are compatible
    // it will fail in pnpm type:check if the types break in the future
  });

  it.skip("should handle complex message types", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
      tools: {
        type: "tools",
        tool_choice: {
          type: "specific_function",
          function_name: "edit_image",
        },
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
                required: ["image_url", "edit_type"],
              },
            },
          },
        ],
      },
      template: {
        type: "chat",
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "Can you edit this image?" }],
          },
          {
            role: "ai",
            content: [
              { type: "text", text: "Yes I can edit this image" },
              {
                type: "tool_call",
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
            ],
          },
          {
            role: "tool",
            content: [
              {
                type: "tool_result",
                tool_call_id: "123",
                tool_result: JSON.stringify({
                  new_image_url: "test_edited.jpg",
                }),
              },
            ],
          },
        ],
      },
    } satisfies PromptVersion;

    const result = toSDK({
      sdk: "ai",
      prompt: mockPrompt,
    });

    expect(result).not.toBeNull();
    invariant(result, "Expected non-null result");

    assertType<PartialAIParams>(result);

    expect(result).toMatchObject({
      messages: [
        {
          content: [
            {
              text: "Can you edit this image?",
              type: "text",
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
              input: '{"image_url":"test.jpg","edit_type":"blur"}',
              toolCallId: "123",
              toolName: "edit_image",
              type: "tool-call",
            },
          ],
          role: "assistant",
        },
        {
          content: [
            {
              output: {
                type: "text",
                value: '{"new_image_url":"test_edited.jpg"}',
              },
              toolCallId: "123",
              toolName: "",
              type: "tool-result",
            },
          ],
          role: "tool",
        },
      ],
      toolChoice: {
        toolName: "edit_image",
        type: "tool",
      },
      tools: {
        edit_image: {
          description: "edit an image",
          inputSchema: {
            _type: undefined,
            jsonSchema: {
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
              required: ["image_url", "edit_type"],
              type: "object",
            },
            validate: undefined,
          },
          type: "function",
        },
      },
    });
  });

  it("should convert and spread into streamText without type errors", () => {
    const mockPrompt = {
      ...BASE_MOCK_PROMPT_VERSION,
    } satisfies PromptVersion;

    const result = toAI({
      prompt: mockPrompt,
      variables: {
        question: "What is the capital of France?",
      },
    });

    expect(result).not.toBeNull();
    invariant(result, "Expected non-null result");

    assertType<PartialAIParams>(result);

    const model = openai("gpt-4o");

    streamText({
      model,
      ...result,
    });

    generateText({
      model,
      ...result,
    });
  });
});
