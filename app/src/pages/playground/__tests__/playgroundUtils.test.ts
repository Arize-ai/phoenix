import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { DEFAULT_MODEL_PROVIDER } from "@phoenix/constants/generativeConstants";
import { LlmProviderToolDefinition } from "@phoenix/schemas";
import { LlmProviderToolCall } from "@phoenix/schemas/toolCallSchemas";
import {
  _resetInstanceId,
  _resetMessageId,
  createOpenAIResponseFormat,
  PlaygroundInput,
  PlaygroundInstance,
} from "@phoenix/store";

import { InvocationParameterInput } from "../__generated__/PlaygroundDatasetExamplesTableSubscription.graphql";
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
import { InvocationParameter } from "../InvocationParametersFormFields";
import {
  areInvocationParamsEqual,
  areRequiredInvocationParametersConfigured,
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
  getVariablesMapFromInstances,
  mergeInvocationParametersWithDefaults,
  processAttributeToolCalls,
  transformSpanAttributesToPlaygroundInstance,
} from "../playgroundUtils";
import { PlaygroundSpan } from "../spanPlaygroundPageLoader";

import {
  basePlaygroundSpan,
  expectedAnthropicToolCall,
  expectedTestOpenAIToolCall,
  expectedUnknownToolCall,
  spanAttributesWithInputMessages,
  SpanTool,
  SpanToolCall,
  testSpanAnthropicTool,
  testSpanAnthropicToolDefinition,
  testSpanOpenAITool,
  testSpanOpenAIToolJsonSchema,
  testSpanToolCall,
} from "./fixtures";

const baseTestPlaygroundInstance: PlaygroundInstance = {
  id: 0,
  activeRunId: null,
  model: {
    provider: "OPENAI",
    modelName: "gpt-3.5-turbo",
    invocationParameters: [],
    supportedInvocationParameters: [],
  },
  tools: [],
  toolChoice: "auto",
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
    invocationParameters: [],
    supportedInvocationParameters: [],
  },
  tools: [],
  toolChoice: "auto",
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
  it("should return the default instance with parsing errors if the span attributes are unparsable", () => {
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
          invocationParameters: [],
          supportedInvocationParameters: [],
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

  it("should return the default instance with parsing errors if the attributes don't contain any information", () => {
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

  it("should return a PlaygroundInstance with template messages and output parsing errors if the attributes contain llm.input_messages", () => {
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

  it("should fallback to output.value if output_messages is not present", () => {
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

  it("should return a PlaygroundInstance if the attributes contain llm.input_messages and output_messages", () => {
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

  it("should normalize message roles, content, and toolCalls for Anthropic", () => {
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
        },
        tools: [
          {
            id: expect.any(Number),
            editorType: "json",
            definition: testSpanOpenAIToolJsonSchema,
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

  it("should correctly parse the model name and infer the provider", () => {
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

  it("should correctly parse the invocation parameters", () => {
    const span: PlaygroundSpan = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({
        ...spanAttributesWithInputMessages,
        llm: {
          ...spanAttributesWithInputMessages.llm,
          // only parameters defined on the span InvocationParameter[] field are parsed
          // note that snake case keys are automatically converted to camel case
          invocation_parameters: `{"top_p": 0.5, "max_tokens": 100, "seed": 12345, "stop": ["stop", "me"], "response_format": ${JSON.stringify(createOpenAIResponseFormat())}}`,
        },
      }),
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        model: {
          ...expectedPlaygroundInstanceWithIO.model,
          invocationParameters: [
            {
              canonicalName: "TOP_P",
              invocationName: "top_p",
              valueFloat: 0.5,
            },
            {
              canonicalName: "MAX_COMPLETION_TOKENS",
              invocationName: "max_tokens",
              valueInt: 100,
            },
            {
              canonicalName: "RANDOM_SEED",
              invocationName: "seed",
              valueInt: 12345,
            },
            {
              canonicalName: "STOP_SEQUENCES",
              invocationName: "stop",
              valueStringList: ["stop", "me"],
            },
            {
              canonicalName: "RESPONSE_FORMAT",
              invocationName: "response_format",
              valueJson: createOpenAIResponseFormat(),
            },
          ],
        },
      } satisfies PlaygroundInstance,
      parsingErrors: [],
    });
  });

  it("should ignore invocation parameters that are not defined on the span", () => {
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
      invocationParameters: [
        {
          __typename: "IntInvocationParameter",
          canonicalName: "MAX_COMPLETION_TOKENS",
          invocationInputField: "value_int",
          invocationName: "max_tokens",
        },
      ],
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      playgroundInstance: {
        ...expectedPlaygroundInstanceWithIO,
        model: {
          ...expectedPlaygroundInstanceWithIO.model,
          invocationParameters: [
            {
              canonicalName: "MAX_COMPLETION_TOKENS",
              invocationName: "max_tokens",
              valueInt: 100,
            },
          ],
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
      },
      parsingErrors: [
        MODEL_CONFIG_WITH_INVOCATION_PARAMETERS_PARSING_ERROR,
        MODEL_CONFIG_WITH_RESPONSE_FORMAT_PARSING_ERROR,
      ],
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
    } = getModelInvocationParametersFromAttributes(parsedAttributes, []);
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
        invocationParameters: [],
        supportedInvocationParameters: [],
      },
      parsingErrors: [MODEL_CONFIG_WITH_INVOCATION_PARAMETERS_PARSING_ERROR],
    });
  });

  it("should only return response format parsing errors if response format is defined AND malformed", () => {
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

  it("should parse multi-part message contents", () => {
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
  it("should return parsed model config if valid with the provider inferred", () => {
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
        invocationParameters: [],
        supportedInvocationParameters: [],
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
    } = getModelInvocationParametersFromAttributes(parsedAttributes, []);
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
        invocationParameters: [],
        supportedInvocationParameters: [],
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
        invocationParameters: [],
        supportedInvocationParameters: [],
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
        invocationParameters: [],
        supportedInvocationParameters: [],
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
        invocationParameters: [],
        supportedInvocationParameters: [],
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
      invocationParameters: [],
      supportedInvocationParameters: [],
    },
    tools: [],
    toolChoice: "auto",
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

type ProviderToolTestTuple<T extends ModelProvider> = [
  T,
  SpanTool,
  LlmProviderToolDefinition,
];

type ProviderToolTestMap = {
  [P in ModelProvider]: ProviderToolTestTuple<P>;
};

describe("getToolsFromAttributes", () => {
  const ProviderToToolTestMap: ProviderToolTestMap = {
    ANTHROPIC: [
      "ANTHROPIC",
      testSpanAnthropicTool,
      testSpanAnthropicToolDefinition,
    ],
    OPENAI: ["OPENAI", testSpanOpenAITool, testSpanOpenAIToolJsonSchema],
    AWS: ["AWS", testSpanOpenAITool, testSpanOpenAIToolJsonSchema],
    DEEPSEEK: ["DEEPSEEK", testSpanOpenAITool, testSpanOpenAIToolJsonSchema],
    XAI: ["XAI", testSpanOpenAITool, testSpanOpenAIToolJsonSchema],
    OLLAMA: ["OLLAMA", testSpanOpenAITool, testSpanOpenAIToolJsonSchema],
    AZURE_OPENAI: [
      "AZURE_OPENAI",
      testSpanOpenAITool,
      testSpanOpenAIToolJsonSchema,
    ],
    // TODO(apowell): #5348 Add Google tool tests
    GOOGLE: ["GOOGLE", testSpanOpenAITool, testSpanOpenAIToolJsonSchema],
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
            id: expect.any(Number),
            editorType: "json",
            definition: toolDefinition,
          },
        ],
        parsingErrors: [],
      });
    }
  );

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
describe("areInvocationParamsEqual", () => {
  it("should return true if invocation names are equal", () => {
    const paramA = {
      invocationName: "max_tokens",
      canonicalName: null,
      valueInt: 100,
    };
    const paramB = {
      invocationName: "max_tokens",
      canonicalName: null,
      valueInt: 200,
    };
    expect(areInvocationParamsEqual(paramA, paramB)).toBe(true);
  });

  it("should return true if canonical names are equal", () => {
    const paramA = {
      invocationName: "max_tokens",
      canonicalName: "MAX_COMPLETION_TOKENS" as const,
      valueInt: 100,
    };
    const paramB = {
      invocationName: "max_tokens_alt",
      canonicalName: "MAX_COMPLETION_TOKENS" as const,
      valueInt: 200,
    };
    expect(areInvocationParamsEqual(paramA, paramB)).toBe(true);
  });

  it("should return false if neither invocation names nor canonical names are equal", () => {
    const paramA = {
      invocationName: "max_tokens",
      canonicalName: "MAX_COMPLETION_TOKENS" as const,
      valueInt: 100,
    };
    const paramB = {
      invocationName: "top_p",
      canonicalName: "TOP_P" as const,
      valueFloat: 0.9,
    };
    expect(areInvocationParamsEqual(paramA, paramB)).toBe(false);
  });

  it("should return false if one canonical name is null and invocation names are not equal", () => {
    const paramA = {
      invocationName: "max_tokens",
      canonicalName: null,
      valueInt: 100,
    };
    const paramB = {
      invocationName: "top_p",
      canonicalName: "TOP_P" as const,
      valueFloat: 0.9,
    };
    expect(areInvocationParamsEqual(paramA, paramB)).toBe(false);
  });

  it("should return false if both canonical names are null and invocation names are not equal", () => {
    const paramA = {
      invocationName: "max_tokens",
      canonicalName: null,
      valueInt: 100,
    };
    const paramB = {
      invocationName: "top_p",
      canonicalName: null,
      valueFloat: 0.9,
    };
    expect(areInvocationParamsEqual(paramA, paramB)).toBe(false);
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

describe("areRequiredInvocationParametersConfigured", () => {
  it("should return true if all required parameters are configured", () => {
    const configuredInvocationParameters: InvocationParameterInput[] = [
      {
        invocationName: "max_tokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        valueInt: 1,
      },
      { invocationName: "seed", canonicalName: "RANDOM_SEED", valueInt: 2 },
    ];
    const supportedInvocationParameters: InvocationParameter[] = [
      {
        invocationName: "max_tokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        required: true,
        __typename: "IntInvocationParameter",
      },
      {
        invocationName: "random seed",
        canonicalName: "RANDOM_SEED",
        required: true,
        __typename: "IntInvocationParameter",
      },
    ];
    expect(
      areRequiredInvocationParametersConfigured(
        configuredInvocationParameters,
        supportedInvocationParameters
      )
    ).toBe(true);
  });

  it("should return false if not all required parameters are configured", () => {
    const configuredInvocationParameters: InvocationParameterInput[] = [
      { invocationName: "seed", canonicalName: "RANDOM_SEED", valueInt: 2 },
    ];
    const supportedInvocationParameters: InvocationParameter[] = [
      {
        invocationName: "max_tokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        required: true,
        __typename: "IntInvocationParameter",
      },
      {
        invocationName: "random seed",
        canonicalName: "RANDOM_SEED",
        required: true,
        __typename: "IntInvocationParameter",
      },
    ];
    expect(
      areRequiredInvocationParametersConfigured(
        configuredInvocationParameters,
        supportedInvocationParameters
      )
    ).toBe(false);
  });
});

describe("mergeInvocationParametersWithDefaults", () => {
  it("should merge invocation parameters with default values", () => {
    const invocationParameters: InvocationParameterInput[] = [
      {
        invocationName: "max_tokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        valueInt: 1,
      },
    ];
    const supportedInvocationParameters: InvocationParameter[] = [
      {
        invocationName: "max_tokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        required: true,
        __typename: "IntInvocationParameter",
        intDefaultValue: 5,
        invocationInputField: "value_int",
      },
      {
        invocationName: "random seed",
        canonicalName: "RANDOM_SEED",
        required: true,
        intDefaultValue: 1000,
        __typename: "IntInvocationParameter",
        invocationInputField: "value_int",
      },
    ];
    expect(
      mergeInvocationParametersWithDefaults(
        invocationParameters,
        supportedInvocationParameters
      )
    ).toEqual([
      {
        invocationName: "max_tokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        valueInt: 1,
      },
      {
        invocationName: "random seed",
        canonicalName: "RANDOM_SEED",
        valueInt: 1000,
      },
    ]);
  });

  it("should not overwrite existing values with defaults", () => {
    const invocationParameters: InvocationParameterInput[] = [
      {
        invocationName: "max_tokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        valueInt: 1,
      },
      { invocationName: "seed", canonicalName: "RANDOM_SEED", valueInt: 2 },
    ];
    const supportedInvocationParameters: InvocationParameter[] = [
      {
        invocationName: "max_tokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        required: true,
        __typename: "IntInvocationParameter",
        intDefaultValue: 5,
        invocationInputField: "value_int",
      },
      {
        invocationName: "seed",
        canonicalName: "RANDOM_SEED",
        required: true,
        intDefaultValue: 1000,
        __typename: "IntInvocationParameter",
        invocationInputField: "value_int",
      },
    ];
    expect(
      mergeInvocationParametersWithDefaults(
        invocationParameters,
        supportedInvocationParameters
      )
    ).toEqual([
      {
        invocationName: "max_tokens",
        canonicalName: "MAX_COMPLETION_TOKENS",
        valueInt: 1,
      },
      { invocationName: "seed", canonicalName: "RANDOM_SEED", valueInt: 2 },
    ]);
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
      apiVersion: "2024-10-01-preview",
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
      apiVersion: null,
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
      apiVersion: "2024-06-01",
      endpoint: "https://example.openai.azure.com",
    });
  });

  it("returns nulls when neither URL nor metadata are present", () => {
    const attrs = {};
    const result = getAzureConfigFromAttributes(attrs);
    expect(result).toEqual({
      deploymentName: null,
      apiVersion: null,
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
      apiVersion: null,
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
      apiVersion: null,
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
      apiVersion: null,
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
      apiVersion: null,
      endpoint: null,
    });
  });
});
