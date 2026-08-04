import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { DEFAULT_MODEL_PROVIDER } from "@phoenix/constants/generativeConstants";
import type { LlmProviderToolCall } from "@phoenix/schemas/toolCallSchemas";
import type { PlaygroundInput, PlaygroundInstance } from "@phoenix/store";
import { _resetInstanceId, _resetMessageId } from "@phoenix/store";
import type { CanonicalToolDefinition } from "@phoenix/store/playground";
import type { Tool } from "@phoenix/store/playground";

import {
  INPUT_MESSAGES_PARSING_ERROR,
  MODEL_CONFIG_PARSING_ERROR,
  MODEL_CONFIG_WITH_INVOCATION_PARAMETERS_PARSING_ERROR,
  MODEL_CONFIG_WITH_RESPONSE_FORMAT_PARSING_ERROR,
  OUTPUT_MESSAGES_PARSING_ERROR,
  OUTPUT_VALUE_PARSING_ERROR,
  PROMPT_TEMPLATE_VARIABLES_PARSING_ERROR,
  SPAN_ATTRIBUTES_PARSING_ERROR,
  TOOLS_PARSING_ERROR,
} from "../constants";
import {
  extractRootVariable,
  extractRootVariables,
  extractVariablesFromInstances,
  getAzureConfigFromAttributes,
  getBaseModelConfigFromAttributes,
  getChatRole,
  getModelInvocationParametersFromAttributes,
  getModelProviderFromModelName,
  getOutputFromAttributes,
  getPromptTemplateVariablesFromAttributes,
  getTemplateMessagesFromAttributes,
  getToolsFromAttributes,
  getResponseFormatFromAttributes,
  getToolChoiceFromAttributes,
  getToolName,
  getVariablesMapFromInstances,
  findUnresolvedToolCallIds,
  inferOpenAIApiTypeFromRawToolDefinitions,
  inferOpenAIApiTypeFromTools,
  isOpenAIResponsesSpan,
  processAttributeToolCalls,
  promptToolFromGraphQL,
  toolFromEditorJSON,
  toolToPromptToolInput,
  transformSpanAttributesToPlaygroundInstance,
} from "../playgroundUtils";
import { getDefaultInvocationConfig } from "../providerAdapters";
import type { PlaygroundSpan } from "../spanPlaygroundPageLoader";
import type { SpanTool, SpanToolCall } from "./fixtures";
import {
  basePlaygroundSpan,
  expectedAnthropicToolCall,
  expectedTestOpenAIToolCall,
  expectedUnknownToolCall,
  spanAttributesWithInputMessages,
  testSpanAnthropicTool,
  testSpanAnthropicToolCanonical,
  testSpanOpenAITool,
  testSpanOpenAIToolCanonical,
  testSpanToolCall,
} from "./fixtures";

const baseTestPlaygroundInstance: PlaygroundInstance = {
  id: 0,
  activeRunId: null,
  model: {
    provider: "OPENAI",
    modelName: "gpt-3.5-turbo",
    invocationParameters: getDefaultInvocationConfig("OPENAI"),
    openaiApiType: "RESPONSES",
  },
  tools: [],
  toolChoice: { type: "ZERO_OR_MORE" },
  repetitions: {
    1: {
      output: null,
      spanId: null,
      error: null,
      status: "notStarted",
      toolCalls: {},
    },
  },
  selectedRepetitionNumber: 1,
  template: {
    __type: "chat",
    messages: [],
  },
};

const expectedPlaygroundInstanceWithIO: PlaygroundInstance = {
  id: 0,
  activeRunId: null,
  model: {
    provider: "OPENAI",
    modelName: "gpt-3.5-turbo",
    invocationParameters: getDefaultInvocationConfig("OPENAI"),
    openaiApiType: "RESPONSES",
  },
  tools: [],
  toolChoice: { type: "ZERO_OR_MORE" },
  repetitions: {
    1: {
      output: [{ id: 4, content: "This is an AI Answer", role: "ai" }],
      spanId: "fake-span-global-id",
      error: null,
      status: "finished",
      toolCalls: {},
    },
  },
  selectedRepetitionNumber: 1,
  template: {
    __type: "chat",
    // These id's are not 0, 1, 2, because we create a playground instance (including messages) at the top of the transformSpanAttributesToPlaygroundInstance function
    // Doing so increments the message id counter
    messages: [
      { id: 2, content: "You are a chatbot", role: "system" },
      { id: 3, content: "hello?", role: "user" },
    ],
  },
};

const defaultTemplate = {
  __type: "chat",
  messages: [
    {
      id: 0,
      role: "system",
      content: "You are a chatbot",
    },
    {
      id: 1,
      role: "user",
      content: "{{question}}",
    },
  ],
};

describe("transformSpanAttributesToPlaygroundInstance", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
  });
  it.skip("should return the default instance with parsing errors if the span attributes are unparsable", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: "invalid json",
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toStrictEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        model: {
          provider: "OPENAI",
          modelName: "gpt-4o",
          invocationParameters: getDefaultInvocationConfig("OPENAI"),
          openaiApiType: "RESPONSES",
        },
        template: defaultTemplate,
        repetitions: {
          1: {
            output: null,
            spanId: "fake-span-global-id",
            error: null,
            status: "notStarted",
            toolCalls: {},
          },
        },
        selectedRepetitionNumber: 1,
      },
      parsingErrors: [SPAN_ATTRIBUTES_PARSING_ERROR],
    });
  });

  it.skip("should return the default instance with parsing errors if the attributes don't contain any information", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({}),
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toStrictEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        model: {
          ...expectedPlaygroundInstanceWithIO.model,
          provider: "OPENAI",
          modelName: "gpt-4o",
          invocationParameters: {},
        },
        template: defaultTemplate,
        repetitions: {
          1: {
            output: null,
            spanId: "fake-span-global-id",
            error: null,
            status: "finished",
            toolCalls: {},
          },
        },
        selectedRepetitionNumber: 1,
      },
      playgroundInput: undefined,
      parsingErrors: [
        INPUT_MESSAGES_PARSING_ERROR,
        OUTPUT_MESSAGES_PARSING_ERROR,
        OUTPUT_VALUE_PARSING_ERROR,
        MODEL_CONFIG_PARSING_ERROR,
        MODEL_CONFIG_WITH_INVOCATION_PARAMETERS_PARSING_ERROR,
        MODEL_CONFIG_WITH_RESPONSE_FORMAT_PARSING_ERROR,
      ],
    });
  });

  it.skip("should return a PlaygroundInstance with template messages and output parsing errors if the attributes contain llm.input_messages", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({
        ...spanAttributesWithInputMessages,
        llm: {
          ...spanAttributesWithInputMessages.llm,
          output_messages: undefined,
        },
      }),
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        repetitions: {
          1: {
            output: null,
            spanId: "fake-span-global-id",
            error: null,
            status: "finished",
            toolCalls: {},
          },
        },
      },
      parsingErrors: [
        OUTPUT_MESSAGES_PARSING_ERROR,
        OUTPUT_VALUE_PARSING_ERROR,
      ],
    });
  });

  it.skip("should fallback to output.value if output_messages is not present", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({
        ...spanAttributesWithInputMessages,
        llm: {
          ...spanAttributesWithInputMessages.llm,
          output_messages: undefined,
        },
        output: {
          value: "This is an AI Answer",
        },
      }),
    };

    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        repetitions: {
          1: {
            output: "This is an AI Answer",
            spanId: "fake-span-global-id",
            error: null,
            status: "finished",
            toolCalls: {},
          },
        },
      },
      parsingErrors: [OUTPUT_MESSAGES_PARSING_ERROR],
    });
  });

  it.skip("should return a PlaygroundInstance if the attributes contain llm.input_messages and output_messages", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify(spanAttributesWithInputMessages),
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      playgroundInstance: expectedPlaygroundInstanceWithIO,
      parsingErrors: [],
    });
  });

  it("should normalize message roles, content, and toolCalls in input and output messages for OPENAI", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({
        llm: {
          model_name: "gpt-4o",
          input_messages: [
            {
              message: {
                role: "human",
                content: "You are a chatbot",
                tool_calls: [testSpanToolCall],
              },
            },
          ],
          output_messages: [
            {
              message: {
                role: "assistant",
                content: "This is an AI Answer",
              },
            },
          ],
        },
      }),
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        model: {
          ...expectedPlaygroundInstanceWithIO.model,
          provider: "OPENAI",
          modelName: "gpt-4o",
          invocationParameters: {},
        },
        template: {
          __type: "chat",
          messages: [
            {
              id: 2,
              role: "user",
              content: "You are a chatbot",
              toolCalls: [expectedTestOpenAIToolCall],
            },
          ],
        },
        repetitions: {
          1: {
            output: [{ id: 3, content: "This is an AI Answer", role: "ai" }],
            spanId: "fake-span-global-id",
            error: null,
            status: "finished",
            toolCalls: {},
          },
        },
      },
      parsingErrors: [],
    });
  });

  it.skip("should normalize message roles, content, and toolCalls for Anthropic", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({
        llm: {
          model_name: "claude-3-5-sonnet-20240620",
          input_messages: [
            {
              message: {
                role: "human",
                content: "You are a chatbot",
                tool_calls: [testSpanToolCall],
              },
            },
          ],
          output_messages: [
            {
              message: {
                role: "assistant",
                content: "This is an AI Answer",
              },
            },
          ],
        },
      }),
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        model: {
          ...expectedPlaygroundInstanceWithIO.model,
          provider: "ANTHROPIC",
          modelName: "claude-3-5-sonnet-20240620",
        },
        template: {
          __type: "chat",
          messages: [
            {
              id: 2,
              role: "user",
              content: "You are a chatbot",
              toolCalls: [expectedAnthropicToolCall],
            },
          ],
        },
        repetitions: {
          1: {
            output: [{ id: 3, content: "This is an AI Answer", role: "ai" }],
            spanId: "fake-span-global-id",
            error: null,
            status: "finished",
            toolCalls: {},
          },
        },
      },
      parsingErrors: [],
    });
  });

  it("should correctly parse llm.tools", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({
        llm: {
          model_name: "gpt-4o",
          tools: [testSpanOpenAITool],
          input_messages: [
            { message: { content: "You are a chatbot", role: "system" } },
            {
              message: {
                role: "human",
                content: "hello?",
              },
            },
          ],
          output_messages: [
            {
              message: {
                role: "assistant",
                content: "This is an AI Answer",
              },
            },
          ],
        },
      }),
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        model: {
          ...expectedPlaygroundInstanceWithIO.model,
          provider: "OPENAI",
          modelName: "gpt-4o",
          invocationParameters: {},
        },
        tools: [
          {
            kind: "function",
            id: expect.any(Number),
            editorType: "json",
            definition: testSpanOpenAIToolCanonical,
          },
        ],
        repetitions: {
          1: {
            output: [{ id: 4, content: "This is an AI Answer", role: "ai" }],
            spanId: "fake-span-global-id",
            error: null,
            status: "finished",
            toolCalls: {},
          },
        },
      },
      parsingErrors: [],
    });
  });

  it.skip("should correctly parse the model name and infer the provider", () => {
    const openAiAttributes = JSON.stringify({
      ...spanAttributesWithInputMessages,
      llm: {
        ...spanAttributesWithInputMessages.llm,
        model_name: "gpt-3.5-turbo",
      },
    });
    const anthropicAttributes = JSON.stringify({
      ...spanAttributesWithInputMessages,
      llm: {
        ...spanAttributesWithInputMessages.llm,
        model_name: "claude-3-5-sonnet-20240620",
      },
    });
    const unknownAttributes = JSON.stringify({
      ...spanAttributesWithInputMessages,
      llm: {
        ...spanAttributesWithInputMessages.llm,
        model_name: "test-my-deployment",
      },
    });

    expect(
      transformSpanAttributesToPlaygroundInstance({
        ...basePlaygroundSpan,
        attributes: openAiAttributes,
      })
    ).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        model: {
          ...expectedPlaygroundInstanceWithIO.model,
          provider: "OPENAI",
          modelName: "gpt-3.5-turbo",
        },
      },
      parsingErrors: [],
    });

    _resetMessageId();
    _resetInstanceId();

    expect(
      transformSpanAttributesToPlaygroundInstance({
        ...basePlaygroundSpan,
        attributes: anthropicAttributes,
      })
    ).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        model: {
          ...expectedPlaygroundInstanceWithIO.model,
          provider: "ANTHROPIC",
          modelName: "claude-3-5-sonnet-20240620",
        },
      },
      parsingErrors: [],
    });

    _resetMessageId();
    _resetInstanceId();

    expect(
      transformSpanAttributesToPlaygroundInstance({
        ...basePlaygroundSpan,
        attributes: unknownAttributes,
      })
    ).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        model: {
          ...expectedPlaygroundInstanceWithIO.model,
          provider: DEFAULT_MODEL_PROVIDER,
          modelName: "test-my-deployment",
        },
      },
      parsingErrors: [],
    });
  });

  it.skip("should correctly parse the invocation parameters", () => {
    const span: PlaygroundSpan = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({
        ...spanAttributesWithInputMessages,
        llm: {
          ...spanAttributesWithInputMessages.llm,
          // only parameters defined on the span InvocationParameter[] field are parsed
          // note that snake case keys are automatically converted to camel case
          invocation_parameters: `{"top_p": 0.5, "max_tokens": 100, "seed": 12345, "stop": ["stop", "me"], "response_format": ${JSON.stringify(
            {
              type: "json_schema",
              json_schema: {
                name: "response",
                schema: {
                  type: "object",
                  properties: {},
                  required: [],
                  additionalProperties: false,
                },
                strict: true,
              },
            }
          )}}`,
        },
      }),
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        model: {
          ...expectedPlaygroundInstanceWithIO.model,
          responseFormat: {
            type: "json_schema",
            jsonSchema: {
              name: "response",
              schema: {
                type: "object",
                properties: {},
                required: [],
                additionalProperties: false,
              },
              strict: true,
            },
          },
          invocationParameters: {
            topP: 0.5,
            maxCompletionTokens: 100,
            seed: 12345,
            stop: ["stop", "me"],
          },
        },
      } satisfies PlaygroundInstance,
      parsingErrors: [],
    });
  });

  it("preserves Anthropic output_config effort while promoting output_config format", () => {
    const responseSchema = {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    };
    const span: PlaygroundSpan = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({
        ...spanAttributesWithInputMessages,
        llm: {
          ...spanAttributesWithInputMessages.llm,
          model_name: "claude-3-5-sonnet-20240620",
          invocation_parameters: JSON.stringify({
            max_tokens: 2048,
            output_config: {
              effort: "xhigh",
              format: {
                type: "json_schema",
                schema: responseSchema,
              },
            },
          }),
        },
      }),
    };
    const result = transformSpanAttributesToPlaygroundInstance(span);
    expect(result.parsingErrors).toEqual([]);
    expect(result.playgroundInstance.model).toMatchObject({
      provider: "ANTHROPIC",
      modelName: "claude-3-5-sonnet-20240620",
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "response",
          schema: responseSchema,
        },
      },
      invocationParameters: {
        maxTokens: 2048,
        effort: "XHIGH",
      },
    });
  });

  it.skip("should ignore invocation parameters that are not defined on the span", () => {
    const span: PlaygroundSpan = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({
        ...spanAttributesWithInputMessages,
        llm: {
          ...spanAttributesWithInputMessages.llm,
          // only parameters defined on the span InvocationParameter[] field are parsed
          // note that snake case keys are automatically converted to camel case
          invocation_parameters:
            '{"top_p": 0.5, "max_tokens": 100, "seed": 12345, "stop": ["stop", "me"]}',
        },
      }),
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        model: {
          ...expectedPlaygroundInstanceWithIO.model,
          invocationParameters: { maxCompletionTokens: 100 },
        },
      } satisfies PlaygroundInstance,
      parsingErrors: [],
    });
  });

  it("should still parse the model name and provider even if invocation parameters are malformed", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({
        ...spanAttributesWithInputMessages,
        llm: {
          ...spanAttributesWithInputMessages.llm,
          invocation_parameters: "invalid json",
        },
      }),
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        model: {
          ...expectedPlaygroundInstanceWithIO.model,
          invocationParameters: {},
        },
      },
      parsingErrors: [
        MODEL_CONFIG_WITH_INVOCATION_PARAMETERS_PARSING_ERROR,
        MODEL_CONFIG_WITH_RESPONSE_FORMAT_PARSING_ERROR,
      ],
    });
  });

  it("should return invocation parameters parsing errors if the invocation parameters are the wrong type", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({
        ...spanAttributesWithInputMessages,
        llm: {
          ...spanAttributesWithInputMessages.llm,
          invocation_parameters: null,
        },
      }),
    };

    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        model: {
          ...expectedPlaygroundInstanceWithIO.model,
          invocationParameters: {},
        },
      },
      parsingErrors: [
        MODEL_CONFIG_WITH_INVOCATION_PARAMETERS_PARSING_ERROR,
        MODEL_CONFIG_WITH_RESPONSE_FORMAT_PARSING_ERROR,
      ],
    });
  });

  it("normalizes legacy OpenAI max_tokens during span hydration", () => {
    const parsedAttributes = {
      llm: {
        model_name: "gpt-4o-mini",
        invocation_parameters: '{"max_tokens": 321}',
      },
    };

    const { invocationParameters, parsingErrors } =
      getModelInvocationParametersFromAttributes(
        parsedAttributes,
        "OPENAI",
        "CHAT_COMPLETIONS"
      );

    expect(parsingErrors).toEqual([]);
    expect(invocationParameters).toEqual({ maxCompletionTokens: 321 });
  });

  it("normalizes OpenAI Responses parameters during span hydration", () => {
    const parsedAttributes = {
      llm: {
        model_name: "gpt-4.1-mini",
        invocation_parameters:
          '{"max_output_tokens": 77, "reasoning": {"effort": "high"}}',
      },
    };

    const { invocationParameters, parsingErrors } =
      getModelInvocationParametersFromAttributes(
        parsedAttributes,
        "OPENAI",
        "RESPONSES"
      );

    expect(parsingErrors).toEqual([]);
    expect(invocationParameters).toEqual({
      maxCompletionTokens: 77,
      reasoningEffort: "high",
    });
  });

  it("should return invocation parameters parsing errors if they are malformed", () => {
    const parsedAttributes = {
      llm: {
        model_name: "gpt-3.5-turbo",
        invocation_parameters: '"invalid"',
      },
    };
    const { modelConfig, parsingErrors } =
      getBaseModelConfigFromAttributes(parsedAttributes);
    const {
      invocationParameters,
      parsingErrors: invocationParametersParsingErrors,
    } = getModelInvocationParametersFromAttributes(
      parsedAttributes,
      "OPENAI",
      "CHAT_COMPLETIONS"
    );
    expect({
      modelConfig: {
        ...modelConfig,
        invocationParameters,
      },
      parsingErrors: [...parsingErrors, ...invocationParametersParsingErrors],
    }).toEqual({
      modelConfig: {
        modelName: "gpt-3.5-turbo",
        provider: "OPENAI",
        invocationParameters: {},
      },
      parsingErrors: [MODEL_CONFIG_WITH_INVOCATION_PARAMETERS_PARSING_ERROR],
    });
  });

  it.skip("should only return response format parsing errors if response format is defined AND malformed", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({
        ...spanAttributesWithInputMessages,
        llm: {
          ...spanAttributesWithInputMessages.llm,
          invocation_parameters: `{"response_format": 1234}`,
        },
      }),
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
      },
      parsingErrors: [MODEL_CONFIG_WITH_RESPONSE_FORMAT_PARSING_ERROR],
    });
  });

  it.skip("should parse multi-part message contents", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({
        ...spanAttributesWithInputMessages,
        llm: {
          ...spanAttributesWithInputMessages.llm,
          input_messages: [
            {
              message: {
                content: "You are a chatbot",
                role: "system",
              },
            },
            {
              message: {
                role: "user",
                contents: [
                  {
                    message_content: {
                      type: "image",
                      image_url: "https://example.com/image.png",
                    },
                  },
                  { message_content: { type: "text", text: "hello?" } },
                  {
                    message_content: {
                      type: "text",
                      text: "I won't be parsed!",
                    },
                  },
                ],
              },
            },
          ],
        },
      }),
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
      },
      parsingErrors: [],
    });
  });
});

describe("getChatRole", () => {
  it("should return the role if it is a valid ChatMessageRole", () => {
    expect(getChatRole("user")).toEqual("user");
  });

  it("should return the ChatMessageRole if the role is included in ChatRoleMap", () => {
    expect(getChatRole("assistant")).toEqual("ai");
    expect(getChatRole("bot")).toEqual("ai");
    expect(getChatRole("system")).toEqual("system");
    expect(getChatRole("human:")).toEqual("user");
  });

  it("should return DEFAULT_CHAT_ROLE if the role is not found", () => {
    expect(getChatRole("invalid")).toEqual("user");
  });
});

describe("getModelProviderFromModelName", () => {
  it("should return OPENAI if the model name includes 'gpt' or 'o1'", () => {
    expect(getModelProviderFromModelName("gpt-3.5-turbo")).toEqual("OPENAI");
    expect(getModelProviderFromModelName("o1")).toEqual("OPENAI");
  });

  it("should return ANTHROPIC if the model name includes 'claude'", () => {
    expect(getModelProviderFromModelName("claude-3-5-sonnet-20240620")).toEqual(
      "ANTHROPIC"
    );
  });

  it(`should return ${DEFAULT_MODEL_PROVIDER} if the model name does not match any known models`, () => {
    expect(getModelProviderFromModelName("test-my-model")).toEqual(
      DEFAULT_MODEL_PROVIDER
    );
  });
});

describe("processAttributeToolCalls", () => {
  type ProviderToolCallTuple<T extends ModelProvider> = [
    T,
    SpanToolCall,
    LlmProviderToolCall,
  ];

  type ProviderToolCallTestMap = {
    [P in ModelProvider]: ProviderToolCallTuple<P>;
  };

  const ProviderToToolCallTestMap: ProviderToolCallTestMap = {
    ANTHROPIC: ["ANTHROPIC", testSpanToolCall, expectedAnthropicToolCall],
    OPENAI: ["OPENAI", testSpanToolCall, expectedTestOpenAIToolCall],
    AWS: ["AWS", testSpanToolCall, expectedTestOpenAIToolCall],
    DEEPSEEK: ["DEEPSEEK", testSpanToolCall, expectedTestOpenAIToolCall],
    XAI: ["XAI", testSpanToolCall, expectedTestOpenAIToolCall],
    OLLAMA: ["OLLAMA", testSpanToolCall, expectedTestOpenAIToolCall],
    AZURE_OPENAI: [
      "AZURE_OPENAI",
      testSpanToolCall,
      expectedTestOpenAIToolCall,
    ],
    // TODO(apowell): #5348 Add Google tool tests
    GOOGLE: ["GOOGLE", testSpanToolCall, expectedUnknownToolCall],
    CEREBRAS: ["CEREBRAS", testSpanToolCall, expectedTestOpenAIToolCall],
    FIREWORKS: ["FIREWORKS", testSpanToolCall, expectedTestOpenAIToolCall],
    GROQ: ["GROQ", testSpanToolCall, expectedTestOpenAIToolCall],
    MOONSHOT: ["MOONSHOT", testSpanToolCall, expectedTestOpenAIToolCall],
    PERPLEXITY: ["PERPLEXITY", testSpanToolCall, expectedTestOpenAIToolCall],
    TOGETHER: ["TOGETHER", testSpanToolCall, expectedTestOpenAIToolCall],
  };
  test.for(Object.values(ProviderToToolCallTestMap))(
    "should return %s tools, if they are valid",
    ([provider, spanToolCall, processedToolCall]) => {
      const result = processAttributeToolCalls({
        provider,
        toolCalls: [spanToolCall],
      });
      expect(result).toEqual([processedToolCall]);
    }
  );

  it("should filter out nullish tool calls", () => {
    const toolCalls = [{}, testSpanToolCall];
    expect(
      processAttributeToolCalls({ provider: "OPENAI", toolCalls })
    ).toEqual([expectedTestOpenAIToolCall]);
  });
});

describe("getTemplateMessagesFromAttributes", () => {
  it("should return parsing errors if input messages are invalid", () => {
    const parsedAttributes = { llm: { input_messages: "invalid" } };
    expect(
      getTemplateMessagesFromAttributes({
        provider: DEFAULT_MODEL_PROVIDER,
        parsedAttributes,
      })
    ).toEqual({
      messageParsingErrors: [INPUT_MESSAGES_PARSING_ERROR],
      messages: null,
    });
  });

  it("should return parsed messages as ChatMessages if input messages are valid", () => {
    const parsedAttributes = {
      llm: {
        input_messages: [
          {
            message: {
              role: "human",
              content: "Hello",
              tool_calls: [testSpanToolCall],
            },
          },
        ],
      },
    };
    expect(
      getTemplateMessagesFromAttributes({
        provider: "OPENAI",
        parsedAttributes,
      })
    ).toEqual({
      messageParsingErrors: [],
      messages: [
        {
          id: expect.any(Number),
          role: "user",
          content: "Hello",
          toolCalls: [expectedTestOpenAIToolCall],
        },
      ],
    });
  });
});

describe("getOutputFromAttributes", () => {
  it("should return parsing errors if output messages are invalid", () => {
    const parsedAttributes = { llm: { output_messages: "invalid" } };
    expect(
      getOutputFromAttributes({
        provider: DEFAULT_MODEL_PROVIDER,
        parsedAttributes,
      })
    ).toEqual({
      output: undefined,
      outputParsingErrors: [
        OUTPUT_MESSAGES_PARSING_ERROR,
        OUTPUT_VALUE_PARSING_ERROR,
      ],
    });
  });

  it("should return parsed output if output messages are valid", () => {
    const parsedAttributes = {
      llm: {
        output_messages: [
          {
            message: {
              role: "ai",
              content: "This is an AI Answer",
            },
          },
        ],
      },
    };
    expect(
      getOutputFromAttributes({
        provider: DEFAULT_MODEL_PROVIDER,
        parsedAttributes,
      })
    ).toEqual({
      output: [
        {
          id: expect.any(Number),
          role: "ai",
          content: "This is an AI Answer",
        },
      ],
      outputParsingErrors: [],
    });
  });

  it("should fallback to output.value if output_messages is not present", () => {
    const parsedAttributes = {
      output: {
        value: "This is an AI Answer",
      },
    };
    expect(
      getOutputFromAttributes({
        provider: DEFAULT_MODEL_PROVIDER,
        parsedAttributes,
      })
    ).toEqual({
      output: "This is an AI Answer",
      outputParsingErrors: [OUTPUT_MESSAGES_PARSING_ERROR],
    });
  });
});

describe("getModelConfigFromAttributes", () => {
  it("should return parsing errors if model config is invalid", () => {
    const parsedAttributes = { llm: { model_name: 123 } };
    expect(getBaseModelConfigFromAttributes(parsedAttributes)).toEqual({
      modelConfig: null,
      parsingErrors: [MODEL_CONFIG_PARSING_ERROR],
    });
  });

  // TODO(apowell): Re-enable when invocation parameters are parseable from span
  it.skip("should return parsed model config if valid with the provider inferred", () => {
    const parsedAttributes = {
      llm: {
        model_name: "gpt-3.5-turbo",
        invocation_parameters: '{"top_p": 0.5, "max_tokens": 100}',
      },
    };
    expect(getBaseModelConfigFromAttributes(parsedAttributes)).toEqual({
      modelConfig: {
        modelName: "gpt-3.5-turbo",
        provider: "OPENAI",
        // getBaseModelConfigFromAttributes does not parse invocation parameters
        invocationParameters: getDefaultInvocationConfig("OPENAI"),
      },
      parsingErrors: [],
    });
  });

  it("should return invocation parameters parsing errors if they are malformed", () => {
    const parsedAttributes = {
      llm: {
        model_name: "gpt-3.5-turbo",
        invocation_parameters: 100,
      },
    };
    const { modelConfig, parsingErrors } =
      getBaseModelConfigFromAttributes(parsedAttributes);
    const {
      invocationParameters,
      parsingErrors: invocationParametersParsingErrors,
    } = getModelInvocationParametersFromAttributes(
      parsedAttributes,
      "OPENAI",
      "CHAT_COMPLETIONS"
    );
    expect({
      modelConfig: {
        ...modelConfig,
        invocationParameters,
      },
      parsingErrors: [...parsingErrors, ...invocationParametersParsingErrors],
    }).toEqual({
      modelConfig: {
        modelName: "gpt-3.5-turbo",
        provider: "OPENAI",
        invocationParameters: {},
      },
      parsingErrors: [MODEL_CONFIG_WITH_INVOCATION_PARAMETERS_PARSING_ERROR],
    });
  });

  it("should return a baseUrl if the attributes contain url.full", () => {
    const parsedAttributes = {
      llm: {
        model_name: "gpt-3.5-turbo",
        invocation_parameters: 100,
      },
      url: {
        full: "https://api.openai.com/v1/chat/completions",
      },
    };
    const { modelConfig, parsingErrors } =
      getBaseModelConfigFromAttributes(parsedAttributes);
    expect({
      modelConfig: {
        ...modelConfig,
      },
      parsingErrors,
    }).toEqual({
      modelConfig: {
        modelName: "gpt-3.5-turbo",
        provider: "OPENAI",
        invocationParameters: getDefaultInvocationConfig("OPENAI"),
        baseUrl: "https://api.openai.com/v1/chat/completions",
      },
      parsingErrors: [],
    });
  });

  it("should return baseUrl as url.full minus url.path if the attributes contain url.full and url.path", () => {
    const parsedAttributes = {
      llm: {
        model_name: "gpt-3.5-turbo",
        invocation_parameters: 100,
      },
      url: {
        full: "https://api.openai.com/v1/chat/completions?api-version=2020-05-03",
        path: "chat/completions",
      },
    };
    const { modelConfig, parsingErrors } =
      getBaseModelConfigFromAttributes(parsedAttributes);
    expect({
      modelConfig: {
        ...modelConfig,
      },
      parsingErrors,
    }).toEqual({
      modelConfig: {
        modelName: "gpt-3.5-turbo",
        provider: "OPENAI",
        invocationParameters: getDefaultInvocationConfig("OPENAI"),
        baseUrl: "https://api.openai.com/v1/",
      },
      parsingErrors: [],
    });
  });

  it("should not set apiVersion for non-Azure providers even if url contains api-version", () => {
    const parsedAttributes = {
      llm: {
        model_name: "gpt-3.5-turbo",
        invocation_parameters: 100,
      },
      url: {
        full: "https://api.openai.com/v1/chat/completions?api-version=2020-05-03",
      },
    };
    const { modelConfig, parsingErrors } =
      getBaseModelConfigFromAttributes(parsedAttributes);
    expect({
      modelConfig: {
        ...modelConfig,
      },
      parsingErrors,
    }).toEqual({
      modelConfig: {
        modelName: "gpt-3.5-turbo",
        provider: "OPENAI",
        invocationParameters: getDefaultInvocationConfig("OPENAI"),
        baseUrl: "https://api.openai.com/v1/chat/completions",
      },
      parsingErrors: [],
    });
  });
});

describe("extractVariablesFromInstances", () => {
  it("should extract variables from chat messages", () => {
    const instances: PlaygroundInstance[] = [
      {
        ...baseTestPlaygroundInstance,
        template: {
          __type: "chat",
          messages: [
            { id: 0, content: "Hello {{name}}", role: "user" },
            { id: 1, content: "How are you, {{name}}?", role: "ai" },
          ],
        },
      },
    ];
    const templateFormat = TemplateFormats.Mustache;
    expect(
      extractVariablesFromInstances({ instances, templateFormat })
    ).toEqual(["name"]);
  });

  it("should extract variables from text completion prompts", () => {
    const instances: PlaygroundInstance[] = [
      {
        ...baseTestPlaygroundInstance,
        template: {
          __type: "text_completion",
          prompt: "Hello {{name}}",
        },
      },
    ];
    const templateFormat = TemplateFormats.Mustache;
    expect(
      extractVariablesFromInstances({ instances, templateFormat })
    ).toEqual(["name"]);
  });

  it("should handle multiple instances and variable extraction", () => {
    const instances: PlaygroundInstance[] = [
      {
        ...baseTestPlaygroundInstance,
        template: {
          __type: "chat",
          messages: [
            { id: 0, content: "Hello {{name}}", role: "user" },
            { id: 1, content: "How are you, {{name}}?", role: "ai" },
          ],
        },
      },
      {
        ...baseTestPlaygroundInstance,
        template: {
          __type: "text_completion",
          prompt: "Your age is {{age}}",
        },
      },
    ];
    const templateFormat = TemplateFormats.Mustache;
    expect(
      extractVariablesFromInstances({ instances, templateFormat })
    ).toEqual(["name", "age"]);
  });

  it("should handle multiple instances and variable extraction with fstring", () => {
    const instances: PlaygroundInstance[] = [
      {
        ...baseTestPlaygroundInstance,
        template: {
          __type: "chat",
          messages: [
            { id: 0, content: "Hello {name}", role: "user" },
            { id: 1, content: "How are you, {{escaped}}?", role: "ai" },
          ],
        },
      },
      {
        ...baseTestPlaygroundInstance,
        template: {
          __type: "text_completion",
          prompt: "Your age is {age}",
        },
      },
    ];
    const templateFormat = TemplateFormats.FString;
    expect(
      extractVariablesFromInstances({ instances, templateFormat })
    ).toEqual(["name", "age"]);
  });
});

describe("getVariablesMapFromInstances", () => {
  const baseTestPlaygroundInstance: PlaygroundInstance = {
    id: 0,
    activeRunId: null,
    model: {
      provider: "OPENAI",
      modelName: "gpt-3.5-turbo",
      invocationParameters: getDefaultInvocationConfig("OPENAI"),
    },
    tools: [],
    toolChoice: { type: "ZERO_OR_MORE" },
    repetitions: {
      1: {
        output: null,
        spanId: null,
        error: null,
        status: "notStarted",
        toolCalls: {},
      },
    },
    selectedRepetitionNumber: 1,
    template: {
      __type: "chat",
      messages: [],
    },
  };

  it("should extract variables and map them correctly for chat messages", () => {
    const instances: PlaygroundInstance[] = [
      {
        ...baseTestPlaygroundInstance,
        template: {
          __type: "chat",
          messages: [
            { id: 0, content: "Hello {{name}}", role: "user" },
            { id: 1, content: "How are you, {{name}}?", role: "ai" },
          ],
        },
      },
    ];
    const templateFormat = TemplateFormats.Mustache;
    const input: PlaygroundInput = { variablesValueCache: { name: "John" } };

    expect(
      getVariablesMapFromInstances({ instances, templateFormat, input })
    ).toEqual({
      variablesMap: { name: "John" },
      variableKeys: ["name"],
    });
  });

  it("should extract variables and map them correctly for text completion prompts", () => {
    const instances: PlaygroundInstance[] = [
      {
        ...baseTestPlaygroundInstance,
        template: {
          __type: "text_completion",
          prompt: "Hello {{name}}",
        },
      },
    ];
    const templateFormat = TemplateFormats.Mustache;
    const input: PlaygroundInput = { variablesValueCache: { name: "John" } };

    expect(
      getVariablesMapFromInstances({ instances, templateFormat, input })
    ).toEqual({
      variablesMap: { name: "John" },
      variableKeys: ["name"],
    });
  });

  it("should handle multiple instances and variable extraction", () => {
    const instances: PlaygroundInstance[] = [
      {
        ...baseTestPlaygroundInstance,
        template: {
          __type: "chat",
          messages: [
            { id: 0, content: "Hello {{name}}", role: "user" },
            { id: 1, content: "How are you, {{name}}?", role: "ai" },
          ],
        },
      },
      {
        ...baseTestPlaygroundInstance,
        template: {
          __type: "chat",
          messages: [{ id: 0, content: "{{name}} is {{age}}", role: "user" }],
        },
      },
    ];
    const templateFormat = TemplateFormats.Mustache;
    const input: PlaygroundInput = {
      variablesValueCache: { name: "John", age: "30" },
    };

    expect(
      getVariablesMapFromInstances({ instances, templateFormat, input })
    ).toEqual({
      variablesMap: { name: "John", age: "30" },
      variableKeys: ["name", "age"],
    });
  });

  it("should handle multiple instances and variable extraction with fstring", () => {
    const instances: PlaygroundInstance[] = [
      {
        ...baseTestPlaygroundInstance,
        template: {
          __type: "chat",
          messages: [
            { id: 0, content: "Hello {name}", role: "user" },
            { id: 1, content: "How are you, {{escaped}}?", role: "ai" },
          ],
        },
      },
      {
        ...baseTestPlaygroundInstance,
        template: {
          __type: "chat",
          messages: [{ id: 0, content: "{name}} is {age}}", role: "user" }],
        },
      },
    ];
    const templateFormat = TemplateFormats.FString;
    const input: PlaygroundInput = {
      variablesValueCache: { name: "John", age: "30" },
    };

    expect(
      getVariablesMapFromInstances({ instances, templateFormat, input })
    ).toEqual({
      variablesMap: { name: "John", age: "30" },
      variableKeys: ["name", "age"],
    });
  });
});

describe("getResponseFormatFromAttributes", () => {
  it("should parse AWS outputConfig with schema as JSON string into responseFormat", () => {
    const schemaString = JSON.stringify({
      type: "object",
      title: "MathReasoning",
      properties: {
        steps: { type: "array", items: { $ref: "#/$defs/Step" } },
        final_answer: { type: "string", title: "Final Answer" },
      },
      required: ["steps", "final_answer"],
      additionalProperties: false,
    });
    const parsedAttributes = {
      llm: {
        invocation_parameters: JSON.stringify({
          inferenceConfig: { maxTokens: 1024 },
          outputConfig: {
            textFormat: {
              type: "json_schema",
              structure: {
                jsonSchema: {
                  schema: schemaString,
                  name: "response",
                },
              },
            },
          },
        }),
      },
    };
    const result = getResponseFormatFromAttributes(parsedAttributes, "AWS");
    expect(result.parsingErrors).toEqual([]);
    expect(result.responseFormat).toEqual({
      type: "json_schema",
      jsonSchema: {
        name: "response",
        schema: JSON.parse(schemaString),
      },
    });
  });
});

describe("getToolChoiceFromAttributes", () => {
  it("should parse AWS Bedrock toolChoice shape { tool: { name } } as SPECIFIC_FUNCTION", () => {
    const parsedAttributes = {
      llm: {
        invocation_parameters: JSON.stringify({
          inferenceConfig: { maxTokens: 1024 },
          toolConfig: {
            toolChoice: { tool: { name: "new_function_1" } },
          },
        }),
      },
    };
    expect(getToolChoiceFromAttributes(parsedAttributes)).toEqual({
      type: "SPECIFIC_FUNCTION",
      functionName: "new_function_1",
    });
  });
});

type ProviderToolTestTuple<T extends ModelProvider> = [
  T,
  SpanTool,
  CanonicalToolDefinition,
];

type ProviderToolTestMap = {
  [P in ModelProvider]: ProviderToolTestTuple<P>;
};

describe("getToolsFromAttributes", () => {
  const ProviderToToolTestMap: ProviderToolTestMap = {
    ANTHROPIC: [
      "ANTHROPIC",
      testSpanAnthropicTool,
      testSpanAnthropicToolCanonical,
    ],
    OPENAI: ["OPENAI", testSpanOpenAITool, testSpanOpenAIToolCanonical],
    AWS: ["AWS", testSpanOpenAITool, testSpanOpenAIToolCanonical],
    DEEPSEEK: ["DEEPSEEK", testSpanOpenAITool, testSpanOpenAIToolCanonical],
    XAI: ["XAI", testSpanOpenAITool, testSpanOpenAIToolCanonical],
    OLLAMA: ["OLLAMA", testSpanOpenAITool, testSpanOpenAIToolCanonical],
    AZURE_OPENAI: [
      "AZURE_OPENAI",
      testSpanOpenAITool,
      testSpanOpenAIToolCanonical,
    ],
    // TODO(apowell): #5348 Add Google tool tests
    GOOGLE: ["GOOGLE", testSpanOpenAITool, testSpanOpenAIToolCanonical],
    CEREBRAS: ["CEREBRAS", testSpanOpenAITool, testSpanOpenAIToolCanonical],
    FIREWORKS: ["FIREWORKS", testSpanOpenAITool, testSpanOpenAIToolCanonical],
    GROQ: ["GROQ", testSpanOpenAITool, testSpanOpenAIToolCanonical],
    MOONSHOT: ["MOONSHOT", testSpanOpenAITool, testSpanOpenAIToolCanonical],
    PERPLEXITY: ["PERPLEXITY", testSpanOpenAITool, testSpanOpenAIToolCanonical],
    TOGETHER: ["TOGETHER", testSpanOpenAITool, testSpanOpenAIToolCanonical],
  };

  test.for(Object.values(ProviderToToolTestMap))(
    "should return %s tools, if they are valid",
    ([_provider, spanTool, toolDefinition]) => {
      const parsedAttributes = {
        llm: {
          tools: [spanTool],
        },
      };
      const result = getToolsFromAttributes(parsedAttributes);
      expect(result).toEqual({
        tools: [
          {
            kind: "function",
            id: expect.any(Number),
            editorType: "json",
            definition: toolDefinition,
          },
        ],
        parsingErrors: [],
      });
    }
  );

  it("should preserve raw non-function tools as raw tools", () => {
    const rawTool = {
      type: "web_search",
      search_context_size: "medium",
    };
    const parsedAttributes = {
      llm: {
        tools: [{ tool: { json_schema: JSON.stringify(rawTool) } }],
      },
    };
    const result = getToolsFromAttributes(parsedAttributes);
    expect(result).toEqual({
      tools: [
        {
          kind: "raw",
          id: expect.any(Number),
          editorType: "json",
          raw: rawTool,
        },
      ],
      parsingErrors: [],
    });
  });

  it("should re-wrap an unwrapped Bedrock toolSpec body that falls through to raw", () => {
    // An unwrapped Bedrock tool body (as recorded by the OpenInference Bedrock
    // instrumentor) that fails strict canonicalization — here an empty
    // description — falls through to a raw passthrough. On import we re-add the
    // Converse `toolSpec` envelope so the replayed tool is valid against the API.
    const unwrappedBody = {
      name: "get_weather",
      description: "",
      inputSchema: {
        json: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
      },
    };
    const parsedAttributes = {
      llm: {
        tools: [{ tool: { json_schema: JSON.stringify(unwrappedBody) } }],
      },
    };
    const result = getToolsFromAttributes(parsedAttributes);
    expect(result).toEqual({
      tools: [
        {
          kind: "raw",
          id: expect.any(Number),
          editorType: "json",
          raw: { toolSpec: unwrappedBody },
        },
      ],
      parsingErrors: [],
    });
  });

  it("should not re-wrap a raw tool when the inputSchema.json marker is absent", () => {
    // With no inputSchema.json marker, a raw passthrough tool is left verbatim.
    const rawTool = {
      name: "web_search",
      type: "web_search_20250305",
    };
    const parsedAttributes = {
      llm: {
        tools: [{ tool: { json_schema: JSON.stringify(rawTool) } }],
      },
    };
    const result = getToolsFromAttributes(parsedAttributes);
    expect(result).toEqual({
      tools: [
        {
          kind: "raw",
          id: expect.any(Number),
          editorType: "json",
          raw: rawTool,
        },
      ],
      parsingErrors: [],
    });
  });

  it("should leave an unwrapped body without the inputSchema.json marker verbatim", () => {
    // inputSchema without the `json` sub-key fails the Bedrock structural marker,
    // so it is not recognized as an unwrapped toolSpec body and is left as-is.
    const unwrappedBody = {
      name: "get_weather",
      inputSchema: {
        type: "object",
        properties: { city: { type: "string" } },
      },
    };
    const parsedAttributes = {
      llm: {
        tools: [{ tool: { json_schema: JSON.stringify(unwrappedBody) } }],
      },
    };
    const result = getToolsFromAttributes(parsedAttributes);
    expect(result).toEqual({
      tools: [
        {
          kind: "raw",
          id: expect.any(Number),
          editorType: "json",
          raw: unwrappedBody,
        },
      ],
      parsingErrors: [],
    });
  });

  it("should load flat OpenAI Responses function tools as function tools", () => {
    const responsesFunctionTool = {
      type: "function",
      name: "get_weather",
      description: "Get the current weather for a location.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name" },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            default: "celsius",
          },
        },
        required: ["city"],
      },
      strict: true,
    };
    const parsedAttributes = {
      llm: {
        tools: [
          { tool: { json_schema: JSON.stringify(responsesFunctionTool) } },
        ],
      },
    };
    const result = getToolsFromAttributes(parsedAttributes);
    expect(result).toEqual({
      tools: [
        {
          kind: "function",
          id: expect.any(Number),
          editorType: "json",
          definition: {
            name: "get_weather",
            description: "Get the current weather for a location.",
            parameters: responsesFunctionTool.parameters,
            strict: true,
          },
        },
      ],
      parsingErrors: [],
    });
  });

  it("should preserve Anthropic hosted web search as a raw tool", () => {
    const rawTool = {
      type: "web_search_20250305",
      name: "web_search",
    };
    const parsedAttributes = {
      llm: {
        tools: [{ tool: { json_schema: JSON.stringify(rawTool) } }],
      },
    };
    const result = getToolsFromAttributes(parsedAttributes);
    expect(result).toEqual({
      tools: [
        {
          kind: "raw",
          id: expect.any(Number),
          editorType: "json",
          raw: rawTool,
        },
      ],
      parsingErrors: [],
    });
  });

  it("should return null tools and parsing errors if tools are invalid", () => {
    const parsedAttributes = { llm: { tools: "invalid" } };
    const result = getToolsFromAttributes(parsedAttributes);
    expect(result).toEqual({
      tools: null,
      parsingErrors: [TOOLS_PARSING_ERROR],
    });
  });

  it("should return null tools and no parsing errors if tools are not present", () => {
    const parsedAttributes = { llm: {} };
    const result = getToolsFromAttributes(parsedAttributes);
    expect(result).toEqual({
      tools: null,
      parsingErrors: [],
    });
  });
});

describe("getToolName", () => {
  it("returns the function definition name for function tools", () => {
    expect(
      getToolName({
        kind: "function",
        id: 1,
        editorType: "json",
        definition: {
          name: "get_weather",
          description: null,
          parameters: {},
          strict: null,
        },
      })
    ).toBe("get_weather");
  });

  it("prefers raw.name over raw.type", () => {
    expect(
      getToolName({
        kind: "raw",
        id: 1,
        editorType: "json",
        raw: { name: "lookup", type: "web_search" },
      })
    ).toBe("lookup");
  });

  it("falls back to raw.type when raw.name is missing", () => {
    expect(
      getToolName({
        kind: "raw",
        id: 1,
        editorType: "json",
        raw: { type: "web_search" },
      })
    ).toBe("web_search");
  });

  it("returns null when neither raw.name nor raw.type is a string", () => {
    expect(
      getToolName({
        kind: "raw",
        id: 1,
        editorType: "json",
        raw: { name: 0, type: 1 },
      })
    ).toBeNull();
  });
});

describe("promptToolFromGraphQL", () => {
  it("converts a PromptToolFunction tool", () => {
    const result = promptToolFromGraphQL({
      __typename: "PromptToolFunction",
      function: {
        name: "get_weather",
        description: "Get the weather",
        parameters: { type: "object" },
        strict: true,
      },
    });
    expect(result).toMatchObject({
      kind: "function",
      editorType: "json",
      definition: {
        name: "get_weather",
        description: "Get the weather",
        parameters: { type: "object" },
        strict: true,
      },
    });
  });

  it("converts a PromptToolRaw tool", () => {
    const result = promptToolFromGraphQL({
      __typename: "PromptToolRaw",
      raw: { type: "web_search" },
    });
    expect(result).toMatchObject({
      kind: "raw",
      editorType: "json",
      raw: { type: "web_search" },
    });
  });

  it("returns null when raw is not an object", () => {
    expect(
      promptToolFromGraphQL({
        __typename: "PromptToolRaw",
        raw: "not an object",
      })
    ).toBeNull();
  });

  it("returns null for the %other variant", () => {
    expect(promptToolFromGraphQL({ __typename: "%other" })).toBeNull();
  });
});

describe("toolToPromptToolInput", () => {
  it("wraps function tools as { function: ... }", () => {
    expect(
      toolToPromptToolInput({
        kind: "function",
        id: 1,
        editorType: "json",
        definition: {
          name: "get_weather",
          description: "Weather",
          parameters: { type: "object" },
          strict: true,
        },
      })
    ).toEqual({
      function: {
        name: "get_weather",
        description: "Weather",
        parameters: { type: "object" },
        strict: true,
      },
    });
  });

  it("wraps raw tools as { raw: ... }", () => {
    expect(
      toolToPromptToolInput({
        kind: "raw",
        id: 1,
        editorType: "json",
        raw: { type: "web_search", search_context_size: "medium" },
      })
    ).toEqual({
      raw: { type: "web_search", search_context_size: "medium" },
    });
  });
});

describe("inferOpenAIApiTypeFromTools", () => {
  const fnTool: Tool = {
    kind: "function",
    id: 1,
    editorType: "json",
    definition: { name: "f", description: null, parameters: {}, strict: null },
  };
  const rawChatCompletionsFunctionTool: Tool = {
    kind: "raw",
    id: 2,
    editorType: "json",
    raw: { type: "function", function: { name: "f" } },
  };
  const rawResponsesFunctionTool: Tool = {
    kind: "raw",
    id: 5,
    editorType: "json",
    raw: { type: "function", name: "f", parameters: { type: "object" } },
  };
  const rawWebSearch: Tool = {
    kind: "raw",
    id: 3,
    editorType: "json",
    raw: { type: "web_search" },
  };
  const rawChatCompletionsCustomTool: Tool = {
    kind: "raw",
    id: 6,
    editorType: "json",
    raw: { type: "custom", custom: { name: "x", description: "y" } },
  };
  const rawWithoutType: Tool = {
    kind: "raw",
    id: 4,
    editorType: "json",
    raw: { name: "anything" },
  };

  it("returns null for an empty tool list", () => {
    expect(inferOpenAIApiTypeFromTools([])).toBeNull();
  });

  it("returns null when every tool is a normalized function tool", () => {
    expect(inferOpenAIApiTypeFromTools([fnTool, fnTool])).toBeNull();
  });

  it("returns null when raw tools are still in Chat-Completions function shape", () => {
    expect(
      inferOpenAIApiTypeFromTools([fnTool, rawChatCompletionsFunctionTool])
    ).toBeNull();
  });

  it("returns null for raw tools that don't carry a string type", () => {
    expect(inferOpenAIApiTypeFromTools([rawWithoutType])).toBeNull();
  });

  it("returns RESPONSES when any raw tool has a non-function type", () => {
    expect(inferOpenAIApiTypeFromTools([fnTool, rawWebSearch])).toBe(
      "RESPONSES"
    );
    expect(inferOpenAIApiTypeFromTools([rawWebSearch])).toBe("RESPONSES");
  });

  it("returns RESPONSES when a raw function tool is in flat Responses shape", () => {
    expect(inferOpenAIApiTypeFromTools([rawResponsesFunctionTool])).toBe(
      "RESPONSES"
    );
    expect(
      inferOpenAIApiTypeFromTools([fnTool, rawResponsesFunctionTool])
    ).toBe("RESPONSES");
  });

  it("does NOT classify Chat Completions custom tools as Responses", () => {
    expect(
      inferOpenAIApiTypeFromTools([rawChatCompletionsCustomTool])
    ).toBeNull();
    expect(
      inferOpenAIApiTypeFromTools([fnTool, rawChatCompletionsCustomTool])
    ).toBeNull();
  });
});

describe("inferOpenAIApiTypeFromRawToolDefinitions", () => {
  it("returns null for an empty list", () => {
    expect(inferOpenAIApiTypeFromRawToolDefinitions([])).toBeNull();
  });

  it("returns null for nested Chat Completions function tools", () => {
    expect(
      inferOpenAIApiTypeFromRawToolDefinitions([
        { type: "function", function: { name: "f", parameters: {} } },
      ])
    ).toBeNull();
  });

  it("returns RESPONSES for flat Responses function tools", () => {
    expect(
      inferOpenAIApiTypeFromRawToolDefinitions([
        { type: "function", name: "f", parameters: { type: "object" } },
      ])
    ).toBe("RESPONSES");
  });

  it("returns RESPONSES for builtin tool types", () => {
    expect(
      inferOpenAIApiTypeFromRawToolDefinitions([{ type: "web_search" }])
    ).toBe("RESPONSES");
    expect(
      inferOpenAIApiTypeFromRawToolDefinitions([
        { type: "file_search", vector_store_ids: ["vs_1"] },
      ])
    ).toBe("RESPONSES");
    expect(
      inferOpenAIApiTypeFromRawToolDefinitions([
        { type: "computer_use_preview" },
      ])
    ).toBe("RESPONSES");
  });

  it("does NOT classify Chat Completions custom tools as Responses", () => {
    expect(
      inferOpenAIApiTypeFromRawToolDefinitions([
        { type: "custom", custom: { name: "x", description: "y" } },
      ])
    ).toBeNull();
  });

  it("returns RESPONSES when a mixed list contains any Responses-shaped tool", () => {
    expect(
      inferOpenAIApiTypeFromRawToolDefinitions([
        { type: "function", function: { name: "f", parameters: {} } },
        { type: "web_search" },
      ])
    ).toBe("RESPONSES");
  });

  it("returns null for tools without a string type", () => {
    expect(
      inferOpenAIApiTypeFromRawToolDefinitions([{ name: "no-type" }])
    ).toBeNull();
    expect(
      inferOpenAIApiTypeFromRawToolDefinitions([
        { type: 42, function: { name: "f" } },
      ])
    ).toBeNull();
  });

  it("returns null for non-objects", () => {
    expect(
      inferOpenAIApiTypeFromRawToolDefinitions([null, "string", 1, true])
    ).toBeNull();
  });
});

describe("isOpenAIResponsesSpan", () => {
  const wrap = (toolJsonSchemas: readonly unknown[]) => ({
    llm: {
      tools: toolJsonSchemas.map((json_schema) => ({ tool: { json_schema } })),
    },
  });

  it("returns false when parsedAttributes is not an object", () => {
    expect(isOpenAIResponsesSpan(null)).toBe(false);
    expect(isOpenAIResponsesSpan("not an object")).toBe(false);
    expect(isOpenAIResponsesSpan(42)).toBe(false);
  });

  it("returns false when llm is missing or not an object", () => {
    expect(isOpenAIResponsesSpan({})).toBe(false);
    expect(isOpenAIResponsesSpan({ llm: null })).toBe(false);
    expect(isOpenAIResponsesSpan({ llm: "string" })).toBe(false);
  });

  it("returns false when llm.tools is missing or not an array", () => {
    expect(isOpenAIResponsesSpan({ llm: {} })).toBe(false);
    expect(isOpenAIResponsesSpan({ llm: { tools: "string" } })).toBe(false);
  });

  it("returns false when each tool entry has no usable wrapper", () => {
    expect(isOpenAIResponsesSpan({ llm: { tools: [null, "string", 1] } })).toBe(
      false
    );
    expect(isOpenAIResponsesSpan({ llm: { tools: [{ tool: null }] } })).toBe(
      false
    );
    expect(
      isOpenAIResponsesSpan({ llm: { tools: [{ tool: "not-object" }] } })
    ).toBe(false);
  });

  it("returns false when json_schema is not a string", () => {
    expect(
      isOpenAIResponsesSpan(wrap([42, null, { type: "web_search" }]))
    ).toBe(false);
  });

  it("returns false when json_schema is malformed JSON", () => {
    expect(isOpenAIResponsesSpan(wrap(["{not-json"]))).toBe(false);
  });

  it("returns false for a span with only Chat Completions function tools", () => {
    const ccFn = JSON.stringify({
      type: "function",
      function: { name: "f", parameters: {} },
    });
    expect(isOpenAIResponsesSpan(wrap([ccFn, ccFn]))).toBe(false);
  });

  it("returns false for a span with only Chat Completions custom tools", () => {
    const customTool = JSON.stringify({
      type: "custom",
      custom: { name: "x", description: "y" },
    });
    expect(isOpenAIResponsesSpan(wrap([customTool]))).toBe(false);
  });

  it("returns true when any tool is a builtin Responses type", () => {
    const ccFn = JSON.stringify({
      type: "function",
      function: { name: "f", parameters: {} },
    });
    const webSearch = JSON.stringify({ type: "web_search" });
    expect(isOpenAIResponsesSpan(wrap([ccFn, webSearch]))).toBe(true);
  });

  it("returns true when any tool is a flat Responses function", () => {
    const flatFn = JSON.stringify({
      type: "function",
      name: "f",
      parameters: { type: "object" },
    });
    expect(isOpenAIResponsesSpan(wrap([flatFn]))).toBe(true);
  });

  it("ignores entries that fail to parse and classifies based on the rest", () => {
    const malformed = "{not-json";
    const webSearch = JSON.stringify({ type: "web_search" });
    expect(isOpenAIResponsesSpan(wrap([malformed, webSearch]))).toBe(true);
  });
});

describe("toolFromEditorJSON", () => {
  it("should convert function-shaped editor JSON into a function tool", () => {
    const value = {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get weather",
        parameters: {
          type: "object",
          properties: { location: { type: "string" } },
          required: ["location"],
        },
      },
    };

    expect(toolFromEditorJSON({ value, id: 1, editorType: "json" })).toEqual({
      kind: "function",
      id: 1,
      editorType: "json",
      definition: {
        name: "get_weather",
        description: "Get weather",
        parameters: {
          type: "object",
          properties: { location: { type: "string" } },
          required: ["location"],
        },
        strict: null,
      },
    });
  });

  it("should convert function-shaped editor JSON with unknown wrapper fields into a raw tool", () => {
    const value = {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get weather",
        unknown: "unknown",
        parameters: {
          type: "object",
          properties: { location: { type: "string" } },
          required: ["location"],
        },
      },
    };

    expect(toolFromEditorJSON({ value, id: 1, editorType: "json" })).toEqual({
      kind: "raw",
      id: 1,
      editorType: "json",
      raw: value,
    });
  });

  it("should convert non-function object editor JSON into a raw tool", () => {
    const value = {
      type: "web_search",
      search_context_size: "medium",
    };

    expect(toolFromEditorJSON({ value, id: 1, editorType: "json" })).toEqual({
      kind: "raw",
      id: 1,
      editorType: "json",
      raw: value,
    });
  });

  it("should ignore non-object editor JSON", () => {
    expect(
      toolFromEditorJSON({
        value: "not an object",
        id: 1,
        editorType: "json",
      })
    ).toBeNull();
  });
});

describe("getPromptTemplateVariablesFromAttributes", () => {
  it("should return parsing errors if prompt template variables are invalid", () => {
    const parsedAttributes = { llm: { prompt_template: "invalid" } };
    expect(getPromptTemplateVariablesFromAttributes(parsedAttributes)).toEqual({
      variables: null,
      parsingErrors: [PROMPT_TEMPLATE_VARIABLES_PARSING_ERROR],
    });
  });

  it("should return parsed variables if prompt template variables are valid", () => {
    const parsedAttributes = {
      llm: {
        prompt_template: {
          variables: JSON.stringify({
            name: "John",
            age: 30,
          }),
        },
      },
    };
    expect(getPromptTemplateVariablesFromAttributes(parsedAttributes)).toEqual({
      variables: {
        name: "John",
        age: "30",
      },
      parsingErrors: [],
    });
  });

  it("should return null variables and no parsing errors if prompt template is not present", () => {
    const parsedAttributes = { llm: {} };
    expect(getPromptTemplateVariablesFromAttributes(parsedAttributes)).toEqual({
      variables: null,
      parsingErrors: [],
    });
  });
});

describe("getAzureConfigFromAttributes", () => {
  it("returns values from URL when only URL is present (URL precedence)", () => {
    const attrs = {
      url: {
        full: "https://example.openai.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-10-01-preview",
      },
    };

    const result = getAzureConfigFromAttributes(attrs);
    expect(result).toEqual({
      deploymentName: "gpt-4o-mini",
      endpoint: "https://example.openai.azure.com",
    });
  });

  it("falls back to metadata.ls_model_name when URL is absent", () => {
    const attrs = {
      metadata: {
        ls_model_name: "my-azure-deployment",
      },
    };

    const result = getAzureConfigFromAttributes(attrs);
    expect(result).toEqual({
      deploymentName: "my-azure-deployment",
      endpoint: null,
    });
  });

  it("prefers URL deployment name over metadata when both are present", () => {
    const attrs = {
      url: {
        full: "https://example.openai.azure.com/openai/deployments/url-deploy/chat/completions?api-version=2024-06-01",
      },
      metadata: {
        ls_model_name: "meta-deploy",
      },
    };

    const result = getAzureConfigFromAttributes(attrs);
    expect(result).toEqual({
      deploymentName: "url-deploy",
      endpoint: "https://example.openai.azure.com",
    });
  });

  it("returns nulls when neither URL nor metadata are present", () => {
    const attrs = {};
    const result = getAzureConfigFromAttributes(attrs);
    expect(result).toEqual({
      deploymentName: null,
      endpoint: null,
    });
  });

  it("handles malformed URL by falling back to metadata", () => {
    const attrs = {
      url: {
        full: "not a valid url",
      },
      metadata: {
        ls_model_name: "meta-deploy",
      },
    };

    const result = getAzureConfigFromAttributes(attrs);
    expect(result).toEqual({
      deploymentName: "meta-deploy",
      endpoint: null,
    });
  });

  it("parses deployment when URL path ends with trailing slash", () => {
    const attrs = {
      url: {
        full: "https://example.openai.azure.com/openai/deployments/url-deploy/",
      },
    };
    const result = getAzureConfigFromAttributes(attrs);
    expect(result).toEqual({
      deploymentName: "url-deploy",
      endpoint: "https://example.openai.azure.com",
    });
  });

  it("does not override metadata when URL has no deployments segment", () => {
    const attrs = {
      url: {
        full: "https://example.openai.azure.com/openai/chat/completions",
      },
      metadata: {
        ls_model_name: "meta-deploy",
      },
    };
    const result = getAzureConfigFromAttributes(attrs);
    expect(result).toEqual({
      deploymentName: "meta-deploy",
      endpoint: "https://example.openai.azure.com",
    });
  });

  it("trims ls_model_name from metadata", () => {
    const attrs = {
      metadata: {
        ls_model_name: "  meta-deploy  ",
      },
    };
    const result = getAzureConfigFromAttributes(attrs);
    expect(result).toEqual({
      deploymentName: "meta-deploy",
      endpoint: null,
    });
  });
});

describe("extractRootVariable", () => {
  it("should return simple variable names unchanged", () => {
    expect(extractRootVariable("name")).toBe("name");
    expect(extractRootVariable("input")).toBe("input");
    expect(extractRootVariable("reference")).toBe("reference");
  });

  it("should extract root from dot notation paths", () => {
    expect(extractRootVariable("reference.label")).toBe("reference");
    expect(extractRootVariable("user.name")).toBe("user");
    expect(extractRootVariable("input.input.messages")).toBe("input");
    expect(extractRootVariable("user.address.city")).toBe("user");
  });

  it("should extract root from bracket notation", () => {
    expect(extractRootVariable("items[0]")).toBe("items");
    expect(extractRootVariable("reference[label]")).toBe("reference");
  });

  it("should extract root from mixed notation", () => {
    expect(extractRootVariable("items[0].name")).toBe("items");
    expect(extractRootVariable("user.addresses[0].city")).toBe("user");
  });

  it("should handle empty string", () => {
    expect(extractRootVariable("")).toBe("");
  });
});

describe("extractRootVariables", () => {
  it("should extract unique root variables from paths", () => {
    const paths = [
      "input.input.messages",
      "reference.label",
      "input.question",
      "metadata",
    ];
    const result = extractRootVariables(paths);
    expect(result).toEqual(["input", "reference", "metadata"]);
  });

  it("should return empty array for empty input", () => {
    expect(extractRootVariables([])).toEqual([]);
  });

  it("should deduplicate root variables", () => {
    const paths = [
      "user.name",
      "user.email",
      "user.address.city",
      "reference.label",
    ];
    const result = extractRootVariables(paths);
    expect(result).toEqual(["user", "reference"]);
  });
});

describe("findUnresolvedToolCallIds", () => {
  const userMessage = { id: 1, role: "user" as const, content: "ping" };
  const assistantToolUse = {
    id: 2,
    role: "ai" as const,
    content: undefined,
    toolCalls: [
      {
        id: "toolu_abc",
        type: "tool_use" as const,
        name: "memory",
        input: { command: "view", path: "/memories" },
      },
    ],
  };
  const matchingToolResult = {
    id: 3,
    role: "tool" as const,
    content: "ok",
    toolCallId: "toolu_abc",
  };
  const unrelatedToolResult = {
    id: 4,
    role: "tool" as const,
    content: "ok",
    toolCallId: "toolu_other",
  };
  const assistantText = {
    id: 5,
    role: "ai" as const,
    content: "Hello",
  };

  it("returns an empty array when no tool calls are present", () => {
    expect(findUnresolvedToolCallIds([userMessage, assistantText])).toEqual([]);
  });

  it("returns the dangling tool_use id when there is no matching tool result", () => {
    expect(
      findUnresolvedToolCallIds([userMessage, assistantToolUse])
    ).toEqual(["toolu_abc"]);
  });

  it("treats a tool message whose toolCallId matches as a resolution", () => {
    expect(
      findUnresolvedToolCallIds([
        userMessage,
        assistantToolUse,
        matchingToolResult,
      ])
    ).toEqual([]);
  });

  it("ignores tool results that reference a different tool_use id", () => {
    expect(
      findUnresolvedToolCallIds([
        userMessage,
        assistantToolUse,
        unrelatedToolResult,
      ])
    ).toEqual(["toolu_abc"]);
  });

  it("does not flag tool calls with an empty or missing id", () => {
    const blankIdToolCall = {
      id: 6,
      role: "ai" as const,
      content: undefined,
      toolCalls: [
        {
          id: "",
          type: "tool_use" as const,
          name: "memory",
          input: {},
        },
      ],
    };
    expect(findUnresolvedToolCallIds([blankIdToolCall])).toEqual([]);
  });

  it("only inspects assistant messages, not user messages that happen to have toolCalls", () => {
    const userWithToolCalls = {
      id: 7,
      role: "user" as const,
      content: undefined,
      toolCalls: [
        {
          id: "toolu_user",
          type: "tool_use" as const,
          name: "memory",
          input: {},
        },
      ],
    };
    expect(findUnresolvedToolCallIds([userWithToolCalls])).toEqual([]);
  });
});
