import {
  getTestAnthropicToolCall,
  getTestOpenAIToolCall,
} from "@phoenix/schemas/__tests__/fixtures";

import { convertMessageToolCallsToProvider } from "../playgroundStoreUtils";
import type { ChatMessage } from "../types";

type TestName = string;
type ToolCallConversionTestTuple<T extends ModelProvider> = [
  TestName,
  T,
  ChatMessage["toolCalls"],
  ChatMessage["toolCalls"],
];

type ToolCallConversionTestMap = {
  [P in ModelProvider]: ToolCallConversionTestTuple<P>[];
};

describe("convertMessageToolCallsToProvider", () => {
  const ProviderToToolTestMap: ToolCallConversionTestMap = {
    ANTHROPIC: [
      [
        "convert from openai to anthropic",
        "ANTHROPIC",
        [
          getTestOpenAIToolCall({
            function: {
              name: "my test func",
              arguments: { test: "arg" },
            },
          }),
        ],
        [
          getTestAnthropicToolCall({
            name: "my test func",
            input: { test: "arg" },
          }),
        ],
      ],
      [
        "return anthropic as is if it is already anthropic",
        "ANTHROPIC",
        [
          getTestAnthropicToolCall({
            name: "my test func",
            input: { test: "arg" },
          }),
        ],
        [
          getTestAnthropicToolCall({
            name: "my test func",
            input: { test: "arg" },
          }),
        ],
      ],
      [
        "return tools as they are if unknown schema for anthropic",
        "ANTHROPIC",
        [{ test: "test" }],
        [{ test: "test" }],
      ],
    ],
    OPENAI: [
      [
        "convert from anthropic to openai",
        "OPENAI",
        [
          getTestAnthropicToolCall({
            name: "my test func",
            input: { test: "arg" },
          }),
        ],
        [
          getTestOpenAIToolCall({
            function: {
              name: "my test func",
              arguments: { test: "arg" },
            },
          }),
        ],
      ],
      [
        "return openai as is if it is already openai",
        "OPENAI",
        [
          getTestOpenAIToolCall({
            function: {
              name: "my test func",
              arguments: { test: "arg" },
            },
          }),
        ],
        [
          getTestOpenAIToolCall({
            function: {
              name: "my test func",
              arguments: { test: "arg" },
            },
          }),
        ],
      ],
      [
        "return tools as they are if unknown schema for azure_openai",
        "OPENAI",
        [{ test: "test" }],
        [{ test: "test" }],
      ],
    ],
    DEEPSEEK: [
      [
        "return tools as they are for deepseek",
        "DEEPSEEK",
        [{ test: "test" }],
        [{ test: "test" }],
      ],
    ],
    XAI: [
      [
        "return tools as they are for xai",
        "XAI",
        [{ test: "test" }],
        [{ test: "test" }],
      ],
    ],
    OLLAMA: [
      [
        "return tools as they are for ollama",
        "OLLAMA",
        [{ test: "test" }],
        [{ test: "test" }],
      ],
    ],
    AWS: [
      [
        "return tools as they are for aws bedrock",
        "AWS",
        [{ test: "test" }],
        [{ test: "test" }],
      ],
    ],
    AZURE_OPENAI: [
      [
        "convert from anthropic to openai",
        "AZURE_OPENAI",
        [
          getTestAnthropicToolCall({
            name: "my test func",
            input: { test: "arg" },
          }),
        ],
        [
          getTestOpenAIToolCall({
            function: {
              name: "my test func",
              arguments: { test: "arg" },
            },
          }),
        ],
      ],
      [
        "return openai as is if it is already azure_openai",
        "AZURE_OPENAI",
        [
          getTestOpenAIToolCall({
            function: {
              name: "my test func",
              arguments: { test: "arg" },
            },
          }),
        ],
        [
          getTestOpenAIToolCall({
            function: {
              name: "my test func",
              arguments: { test: "arg" },
            },
          }),
        ],
      ],
      [
        "return tools as they are if unknown schema for azure_openai",
        "AZURE_OPENAI",
        [{ test: "test" }],
        [{ test: "test" }],
      ],
    ],
    // TODO(apowell): #5348 Add Google tool tests
    GOOGLE: [
      [
        "return tools as they are for google",
        "GOOGLE",
        [{ test: "test" }],
        [{ test: "test" }],
      ],
    ],
    CEREBRAS: [
      [
        "return tools as they are for cerebras",
        "CEREBRAS",
        [{ test: "test" }],
        [{ test: "test" }],
      ],
    ],
    FIREWORKS: [
      [
        "return tools as they are for fireworks",
        "FIREWORKS",
        [{ test: "test" }],
        [{ test: "test" }],
      ],
    ],
    GROQ: [
      [
        "return tools as they are for groq",
        "GROQ",
        [{ test: "test" }],
        [{ test: "test" }],
      ],
    ],
    MOONSHOT: [
      [
        "return tools as they are for moonshot",
        "MOONSHOT",
        [{ test: "test" }],
        [{ test: "test" }],
      ],
    ],
    PERPLEXITY: [
      [
        "return tools as they are for perplexity",
        "PERPLEXITY",
        [{ test: "test" }],
        [{ test: "test" }],
      ],
    ],
    TOGETHER: [
      [
        "return tools as they are for together",
        "TOGETHER",
        [{ test: "test" }],
        [{ test: "test" }],
      ],
    ],
  };

  test.for(Object.values(ProviderToToolTestMap).flat())(
    "should %s",
    ([_testName, provider, toolCalls, expected]) => {
      const result = convertMessageToolCallsToProvider({ provider, toolCalls });
      expect(result).toStrictEqual(expected);
    }
  );
});
