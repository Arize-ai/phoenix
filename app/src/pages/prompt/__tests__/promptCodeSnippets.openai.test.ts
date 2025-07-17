import { mapPromptToSDKSnippet } from "../promptCodeSnippets";

import {
  BASE_MOCK_PROMPT_VERSION,
  FixturePromptVersion,
  OPENAI_RESPONSE_FORMAT,
  OPENAI_TOOL,
} from "./fixtures";

describe("promptCodeSnippets", () => {
  describe("openai", () => {
    describe("typescript", () => {
      it("should generate basic message template", () => {
        const prompt = {
          ...BASE_MOCK_PROMPT_VERSION,
          template: {
            __typename: "PromptChatTemplate",
            messages: [
              {
                role: "USER",
                content: [
                  {
                    __typename: "TextContentPart",
                    text: { text: "Hello OpenAI" },
                  },
                ],
              },
            ],
          },
        } satisfies FixturePromptVersion;

        const result = mapPromptToSDKSnippet({
          promptVersion: prompt,
          language: "TypeScript",
        });
        expect(result).toMatchInlineSnapshot(`
          "import OpenAI from "openai";

          const openai = new OpenAI();

          const messages = [
            {
              role: "user",
              content: "Hello OpenAI"
            }
          ];
          // ^ apply additional templating to messages if needed

          const response = openai.chat.completions.create({
            model: "gpt-4",
            temperature: 0.7,
            messages,
          });

          response.then((completion) => console.log(completion.choices[0].message));"
        `);
      });

      it("should handle tool usage", () => {
        const prompt = {
          ...BASE_MOCK_PROMPT_VERSION,
          invocationParameters: {
            toolChoice: "auto",
          },
          tools: [{ definition: OPENAI_TOOL }],
          template: {
            __typename: "PromptChatTemplate",
            messages: [
              {
                role: "USER",
                content: [
                  {
                    __typename: "TextContentPart",
                    text: { text: "Use the test tool" },
                  },
                  {
                    __typename: "ToolCallContentPart",
                    toolCall: {
                      toolCallId: "call_123",
                      toolCall: {
                        name: OPENAI_TOOL.function.name,
                        arguments: JSON.stringify({ foo: "bar" }),
                      },
                    },
                  },
                ],
              },
              {
                role: "TOOL",
                content: [
                  {
                    __typename: "ToolResultContentPart",
                    toolResult: {
                      toolCallId: "call_123",
                      result: { bar: "baz" },
                    },
                  },
                ],
              },
            ],
          },
        } satisfies FixturePromptVersion;

        const result = mapPromptToSDKSnippet({
          promptVersion: prompt,
          language: "TypeScript",
        });
        expect(result).toMatchInlineSnapshot(`
          "import OpenAI from "openai";

          const openai = new OpenAI();

          const messages = [
            {
              role: "user",
              content: "Use the test tool",
              tool_calls: [
                {
                  id: "call_123",
                  type: "function",
                  function: {
                    name: "test",
                    arguments: "{\\"foo\\":\\"bar\\"}"
                  }
                }
              ]
            },
            {
              role: "tool",
              content: "{\\n  \\"bar\\": \\"baz\\"\\n}",
              tool_call_id: "call_123"
            }
          ];
          // ^ apply additional templating to messages if needed

          const response = openai.chat.completions.create({
            model: "gpt-4",
            toolChoice: "auto",
            messages,
            tools: [
              {
                type: "function",
                function: {
                  name: "test",
                  description: "test function",
                  parameters: {
                    type: "object",
                    properties: {
                      foo: {
                        type: "string"
                      }
                    },
                    required: [
                      "foo"
                    ]
                  }
                }
              }
            ],
          });

          response.then((completion) => console.log(completion.choices[0].message));"
        `);
      });

      it("should include invocation parameters", () => {
        const prompt = {
          ...BASE_MOCK_PROMPT_VERSION,
          invocationParameters: {
            temperature: 0.7,
            max_tokens: 1000,
          },
        } satisfies FixturePromptVersion;

        const result = mapPromptToSDKSnippet({
          promptVersion: prompt,
          language: "TypeScript",
        });
        expect(result).toMatchInlineSnapshot(`
          "import OpenAI from "openai";

          const openai = new OpenAI();

          const messages = [
            {
              role: "user",
              content: "Hello"
            }
          ];
          // ^ apply additional templating to messages if needed

          const response = openai.chat.completions.create({
            model: "gpt-4",
            temperature: 0.7,
            max_tokens: 1000,
            messages,
          });

          response.then((completion) => console.log(completion.choices[0].message));"
        `);
      });

      it("should handle response format", () => {
        const prompt = {
          ...BASE_MOCK_PROMPT_VERSION,
          responseFormat: { definition: OPENAI_RESPONSE_FORMAT },
        } satisfies FixturePromptVersion;

        const result = mapPromptToSDKSnippet({
          promptVersion: prompt,
          language: "TypeScript",
        });
        expect(result).toMatchInlineSnapshot(`
          "import OpenAI from "openai";

          const openai = new OpenAI();

          const messages = [
            {
              role: "user",
              content: "Hello"
            }
          ];
          // ^ apply additional templating to messages if needed

          const response = openai.chat.completions.create({
            model: "gpt-4",
            temperature: 0.7,
            messages,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "test_format",
                description: "test format",
                schema: {
                  type: "object",
                  properties: {
                    format: {
                      type: "string"
                    }
                  }
                }
              }
            },
          });

          response.then((completion) => console.log(completion.choices[0].message));"
        `);
      });
    });

    describe("python", () => {
      it("should generate basic message template", () => {
        const prompt = {
          ...BASE_MOCK_PROMPT_VERSION,
          template: {
            __typename: "PromptChatTemplate",
            messages: [
              {
                role: "USER",
                content: [
                  {
                    __typename: "TextContentPart",
                    text: { text: "Hello OpenAI" },
                  },
                ],
              },
            ],
          },
        } satisfies FixturePromptVersion;

        const result = mapPromptToSDKSnippet({
          promptVersion: prompt,
          language: "Python",
        });
        expect(result).toMatchInlineSnapshot(`
          "from openai import OpenAI

          client = OpenAI()

          messages=[
            {
              "role": "user",
              "content": "Hello OpenAI"
            }
          ]
          # ^ apply additional templating to messages if needed

          completion = client.chat.completions.create(
            model="gpt-4",
            temperature=0.7,
            messages=messages,
          )

          print(completion.choices[0].message)"
        `);
      });

      it("should handle tool usage", () => {
        const prompt = {
          ...BASE_MOCK_PROMPT_VERSION,
          invocationParameters: {
            toolChoice: "auto",
          },
          tools: [{ definition: OPENAI_TOOL }],
          template: {
            __typename: "PromptChatTemplate",
            messages: [
              {
                role: "USER",
                content: [
                  {
                    __typename: "TextContentPart",
                    text: { text: "Use the test tool" },
                  },
                  {
                    __typename: "ToolCallContentPart",
                    toolCall: {
                      toolCallId: "call_123",
                      toolCall: {
                        name: OPENAI_TOOL.function.name,
                        arguments: JSON.stringify({ foo: "bar" }),
                      },
                    },
                  },
                ],
              },
              {
                role: "TOOL",
                content: [
                  {
                    __typename: "ToolResultContentPart",
                    toolResult: {
                      toolCallId: "call_123",
                      result: { bar: "baz" },
                    },
                  },
                ],
              },
            ],
          },
        } satisfies FixturePromptVersion;

        const result = mapPromptToSDKSnippet({
          promptVersion: prompt,
          language: "Python",
        });
        expect(result).toMatchInlineSnapshot(`
          "from openai import OpenAI

          client = OpenAI()

          messages=[
            {
              "role": "user",
              "content": "Use the test tool",
              "tool_calls": [
                {
                  "id": "call_123",
                  "type": "function",
                  "function": {
                    "name": "test",
                    "arguments": "{\\"foo\\":\\"bar\\"}"
                  }
                }
              ]
            },
            {
              "role": "tool",
              "content": "{\\n  \\"bar\\": \\"baz\\"\\n}",
              "tool_call_id": "call_123"
            }
          ]
          # ^ apply additional templating to messages if needed

          completion = client.chat.completions.create(
            model="gpt-4",
            toolChoice="auto",
            messages=messages,
            tools=[
              {
                "type": "function",
                "function": {
                  "name": "test",
                  "description": "test function",
                  "parameters": {
                    "type": "object",
                    "properties": {
                      "foo": {
                        "type": "string"
                      }
                    },
                    "required": [
                      "foo"
                    ]
                  }
                }
              }
            ],
          )

          print(completion.choices[0].message)"
        `);
      });

      it("should include invocation parameters", () => {
        const prompt = {
          ...BASE_MOCK_PROMPT_VERSION,
          invocationParameters: {
            temperature: 0.7,
            max_tokens: 1000,
          },
        } satisfies FixturePromptVersion;

        const result = mapPromptToSDKSnippet({
          promptVersion: prompt,
          language: "Python",
        });
        expect(result).toMatchInlineSnapshot(`
          "from openai import OpenAI

          client = OpenAI()

          messages=[
            {
              "role": "user",
              "content": "Hello"
            }
          ]
          # ^ apply additional templating to messages if needed

          completion = client.chat.completions.create(
            model="gpt-4",
            temperature=0.7,
            max_tokens=1000,
            messages=messages,
          )

          print(completion.choices[0].message)"
        `);
      });

      it("should handle response format", () => {
        const prompt = {
          ...BASE_MOCK_PROMPT_VERSION,
          responseFormat: { definition: OPENAI_RESPONSE_FORMAT },
        } satisfies FixturePromptVersion;

        const result = mapPromptToSDKSnippet({
          promptVersion: prompt,
          language: "Python",
        });
        expect(result).toMatchInlineSnapshot(`
          "from openai import OpenAI

          client = OpenAI()

          messages=[
            {
              "role": "user",
              "content": "Hello"
            }
          ]
          # ^ apply additional templating to messages if needed

          completion = client.chat.completions.create(
            model="gpt-4",
            temperature=0.7,
            messages=messages,
            response_format={
              "type": "json_schema",
              "json_schema": {
                "name": "test_format",
                "description": "test format",
                "schema": {
                  "type": "object",
                  "properties": {
                    "format": {
                      "type": "string"
                    }
                  }
                }
              }
            },
          )

          print(completion.choices[0].message)"
        `);
      });
    });
  });
});
