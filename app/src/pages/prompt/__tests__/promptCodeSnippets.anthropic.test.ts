import { mapPromptToSDKSnippet } from "../promptCodeSnippets";

import {
  ANTHROPIC_TOOL,
  BASE_MOCK_PROMPT_VERSION,
  FixturePromptVersion,
} from "./fixtures";

describe("promptCodeSnippets", () => {
  describe("anthropic", () => {
    describe("typescript", () => {
      it("should generate basic message template", () => {
        const prompt = {
          ...BASE_MOCK_PROMPT_VERSION,
          modelProvider: "ANTHROPIC",
          modelName: "claude-3-sonnet-latest",
          template: {
            __typename: "PromptChatTemplate",
            messages: [
              {
                role: "USER",
                content: [
                  {
                    __typename: "TextContentPart",
                    text: { text: "Hello Claude" },
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
          "import Anthropic from "@anthropic-ai/sdk";

          const client = new Anthropic();

          const messages = [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Hello Claude"
                }
              ]
            }
          ];
          // ^ apply additional templating to messages if needed

          const response = await client.messages.create({
            model: "claude-3-sonnet-latest",
            temperature: 0.7,
            messages,
          });

          console.log(response.content);"
        `);
      });

      it("should handle tool usage", () => {
        const prompt = {
          ...BASE_MOCK_PROMPT_VERSION,
          invocationParameters: {
            toolChoice: {
              type: "auto",
            },
          },
          tools: [{ definition: ANTHROPIC_TOOL }],
          modelProvider: "ANTHROPIC",
          modelName: "claude-3-sonnet-latest",
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
                        name: ANTHROPIC_TOOL.name,
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
          "import Anthropic from "@anthropic-ai/sdk";

          const client = new Anthropic();

          const messages = [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Use the test tool"
                },
                {
                  id: "call_123",
                  type: "tool_use",
                  name: "test",
                  input: {
                    foo: "bar"
                  }
                }
              ]
            },
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: "call_123",
                  content: "{\\n  \\"bar\\": \\"baz\\"\\n}"
                }
              ]
            }
          ];
          // ^ apply additional templating to messages if needed

          const response = await client.messages.create({
            model: "claude-3-sonnet-latest",
            toolChoice: {
              type: "auto"
            },
            messages,
            tools: [
              {
                name: "test",
                description: "test function",
                input: {
                  type: "object",
                  properties: {
                    foo: {
                      type: "string"
                    }
                  }
                }
              }
            ],
          });

          console.log(response.content);"
        `);
      });

      it("should include invocation parameters", () => {
        const prompt = {
          ...BASE_MOCK_PROMPT_VERSION,
          modelProvider: "ANTHROPIC",
          modelName: "claude-3-sonnet-latest",
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
          "import Anthropic from "@anthropic-ai/sdk";

          const client = new Anthropic();

          const messages = [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Hello"
                }
              ]
            }
          ];
          // ^ apply additional templating to messages if needed

          const response = await client.messages.create({
            model: "claude-3-sonnet-latest",
            temperature: 0.7,
            max_tokens: 1000,
            messages,
          });

          console.log(response.content);"
        `);
      });
    });

    describe("python", () => {
      it("should generate basic message template", () => {
        const prompt = {
          ...BASE_MOCK_PROMPT_VERSION,
          modelProvider: "ANTHROPIC",
          modelName: "claude-3-sonnet-latest",
          template: {
            __typename: "PromptChatTemplate",
            messages: [
              {
                role: "USER",
                content: [
                  {
                    __typename: "TextContentPart",
                    text: { text: "Hello Claude" },
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
          "from anthropic import Anthropic

          client = Anthropic()

          messages=[
            {
              "role": "user",
              "content": [
                {
                  "type": "text",
                  "text": "Hello Claude"
                }
              ]
            }
          ]
          # ^ apply additional templating to messages if needed

          completion = client.messages.create(
            model="claude-3-sonnet-latest",
            temperature=0.7,
            messages=messages,
          )

          print(completion.content)"
        `);
      });

      it("should handle tool usage", () => {
        const prompt = {
          ...BASE_MOCK_PROMPT_VERSION,
          invocationParameters: {
            toolChoice: {
              type: "auto",
            },
          },
          tools: [{ definition: ANTHROPIC_TOOL }],
          modelProvider: "ANTHROPIC",
          modelName: "claude-3-sonnet-latest",
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
                        name: ANTHROPIC_TOOL.name,
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
          "from anthropic import Anthropic

          client = Anthropic()

          messages=[
            {
              "role": "user",
              "content": [
                {
                  "type": "text",
                  "text": "Use the test tool"
                },
                {
                  "id": "call_123",
                  "type": "tool_use",
                  "name": "test",
                  "input": {
                    "foo": "bar"
                  }
                }
              ]
            },
            {
              "role": "user",
              "content": [
                {
                  "type": "tool_result",
                  "tool_use_id": "call_123",
                  "content": "{\\n  \\"bar\\": \\"baz\\"\\n}"
                }
              ]
            }
          ]
          # ^ apply additional templating to messages if needed

          completion = client.messages.create(
            model="claude-3-sonnet-latest",
            toolChoice={
              "type": "auto"
            },
            messages=messages,
            tools=[
              {
                "name": "test",
                "description": "test function",
                "input": {
                  "type": "object",
                  "properties": {
                    "foo": {
                      "type": "string"
                    }
                  }
                }
              }
            ],
          )

          print(completion.content)"
        `);
      });

      it("should include invocation parameters", () => {
        const prompt = {
          ...BASE_MOCK_PROMPT_VERSION,
          modelProvider: "ANTHROPIC",
          modelName: "claude-3-sonnet-latest",
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
          "from anthropic import Anthropic

          client = Anthropic()

          messages=[
            {
              "role": "user",
              "content": [
                {
                  "type": "text",
                  "text": "Hello"
                }
              ]
            }
          ]
          # ^ apply additional templating to messages if needed

          completion = client.messages.create(
            model="claude-3-sonnet-latest",
            temperature=0.7,
            max_tokens=1000,
            messages=messages,
          )

          print(completion.content)"
        `);
      });
    });
  });
});
