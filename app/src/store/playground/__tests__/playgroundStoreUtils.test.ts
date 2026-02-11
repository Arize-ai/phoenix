import {
  getTestAnthropicToolCall,
  getTestAnthropicToolDefinition,
  getTestOpenAIToolCall,
  getTestOpenAIToolDefinition,
} from "@phoenix/schemas/__tests__/fixtures";

import {
  convertInstanceToolsToProvider,
  convertMessageToolCallsToProvider,
} from "../playgroundStoreUtils";
import { ChatMessage, Tool } from "../types";

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
  };

  test.for(Object.values(ProviderToToolTestMap).flat())(
    "should %s",
    ([_testName, provider, toolCalls, expected]) => {
      const result = convertMessageToolCallsToProvider({ provider, toolCalls });
      expect(result).toStrictEqual(expected);
    }
  );
});

type ToolDefinitionConversionTestTuple<T extends ModelProvider> = [
  TestName,
  T,
  Tool[],
  Tool[],
];

type ToolDefinitionConversionTestMap = {
  [P in ModelProvider]: ToolDefinitionConversionTestTuple<P>[];
};

describe("convertMessageToolCallsToProvider", () => {
  const ProviderToToolTestMap: ToolDefinitionConversionTestMap = {
    ANTHROPIC: [
      [
        "convert from openai to anthropic",
        "ANTHROPIC",
        [
          {
            id: 1,
            editorType: "json",
            definition: getTestOpenAIToolDefinition({
              function: {
                name: "my test func",
                description: "This is a test function",
                parameters: {
                  type: "object",
                  properties: {
                    test: {
                      type: "string",
                    },
                  },
                },
              },
            }),
          },
        ],
        [
          {
            id: 1,
            editorType: "json",
            definition: getTestAnthropicToolDefinition({
              name: "my test func",
              description: "This is a test function",
              input_schema: {
                type: "object",
                properties: {
                  test: {
                    type: "string",
                  },
                },
              },
            }),
          },
        ],
      ],
      [
        "return anthropic as is if it is already anthropic",
        "ANTHROPIC",
        [
          {
            id: 1,
            editorType: "json",
            definition: getTestAnthropicToolDefinition({
              name: "my test func",
              description: "This is a test function",
              input_schema: {
                type: "object",
                properties: {
                  test: {
                    type: "string",
                  },
                },
              },
            }),
          },
        ],
        [
          {
            id: 1,
            editorType: "json",
            definition: getTestAnthropicToolDefinition({
              name: "my test func",
              description: "This is a test function",
              input_schema: {
                type: "object",
                properties: {
                  test: {
                    type: "string",
                  },
                },
              },
            }),
          },
        ],
      ],
      [
        "return tools as they are if unknown schema for anthropic",
        "ANTHROPIC",
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
      ],
    ],
    OPENAI: [
      [
        "convert from anthropic to openai",
        "OPENAI",
        [
          {
            id: 1,
            editorType: "json",
            definition: getTestAnthropicToolDefinition({
              name: "my test func",
              description: "This is a test function",
              input_schema: {
                type: "object",
                properties: {
                  test: {
                    type: "string",
                  },
                },
              },
            }),
          },
        ],
        [
          {
            id: 1,
            editorType: "json",
            definition: getTestOpenAIToolDefinition({
              function: {
                name: "my test func",
                description: "This is a test function",
                parameters: {
                  type: "object",
                  properties: {
                    test: {
                      type: "string",
                    },
                  },
                },
              },
            }),
          },
        ],
      ],
      [
        "return openai as is if it is already openai",
        "OPENAI",
        [
          {
            id: 1,
            editorType: "json",
            definition: getTestOpenAIToolDefinition({
              function: {
                name: "my test func",
                description: "This is a test function",
                parameters: {
                  type: "object",
                  properties: {
                    test: {
                      type: "string",
                    },
                  },
                },
              },
            }),
          },
        ],
        [
          {
            id: 1,
            editorType: "json",
            definition: getTestOpenAIToolDefinition({
              function: {
                name: "my test func",
                description: "This is a test function",
                parameters: {
                  type: "object",
                  properties: {
                    test: {
                      type: "string",
                    },
                  },
                },
              },
            }),
          },
        ],
      ],
      [
        "return tools as they are if unknown schema for azure_openai",
        "OPENAI",
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
      ],
    ],
    DEEPSEEK: [
      [
        "return tools as they are for deepseek",
        "DEEPSEEK",
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
      ],
    ],
    XAI: [
      [
        "return tools as they are for xai",
        "XAI",
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
      ],
    ],
    OLLAMA: [
      [
        "return tools as they are for ollama",
        "OLLAMA",
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
      ],
    ],
    AWS: [
      [
        "return tools as they are for aws",
        "AWS",
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
      ],
    ],
    AZURE_OPENAI: [
      [
        "convert from anthropic to openai",
        "AZURE_OPENAI",
        [
          {
            id: 1,
            editorType: "json",
            definition: getTestAnthropicToolDefinition({
              name: "my test func",
              description: "This is a test function",
              input_schema: {
                type: "object",
                properties: {
                  test: {
                    type: "string",
                  },
                },
              },
            }),
          },
        ],
        [
          {
            id: 1,
            editorType: "json",
            definition: getTestOpenAIToolDefinition({
              function: {
                name: "my test func",
                description: "This is a test function",
                parameters: {
                  type: "object",
                  properties: {
                    test: {
                      type: "string",
                    },
                  },
                },
              },
            }),
          },
        ],
      ],
      [
        "return openai as is if it is already azure_openai",
        "AZURE_OPENAI",
        [
          {
            id: 1,
            editorType: "json",
            definition: getTestOpenAIToolDefinition({
              function: {
                name: "my test func",
                description: "This is a test function",
                parameters: {
                  type: "object",
                  properties: {
                    test: {
                      type: "string",
                    },
                  },
                },
              },
            }),
          },
        ],
        [
          {
            id: 1,
            editorType: "json",
            definition: getTestOpenAIToolDefinition({
              function: {
                name: "my test func",
                description: "This is a test function",
                parameters: {
                  type: "object",
                  properties: {
                    test: {
                      type: "string",
                    },
                  },
                },
              },
            }),
          },
        ],
      ],
      [
        "return tools as they are if unknown schema for azure_openai",
        "AZURE_OPENAI",
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
      ],
    ],
    // TODO(apowell): #5348 Add Google tool tests
    GOOGLE: [
      [
        "return tools as they are for google",
        "GOOGLE",
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
        [{ id: 1, editorType: "json", definition: { test: "test" } }],
      ],
    ],
  };

  test.for(Object.values(ProviderToToolTestMap).flat())(
    "should %s",
    ([_testName, provider, tools, expected]) => {
      const result = convertInstanceToolsToProvider({
        provider,
        instanceTools: tools,
      });
      expect(result).toStrictEqual(expected);
    }
  );
});
