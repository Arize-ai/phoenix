import {
  _resetInstanceId,
  ChatMessageRole,
  DEFAULT_CHAT_COMPLETION_TEMPLATE,
  PlaygroundInstance,
} from "@phoenix/store";

import {
  getChatRole,
  INPUT_MESSAGES_PARSING_ERROR,
  OUTPUT_MESSAGES_PARSING_ERROR,
  OUTPUT_VALUE_PARSING_ERROR,
  SPAN_ATTRIBUTES_PARSING_ERROR,
  transformSpanAttributesToPlaygroundInstance,
} from "../playgroundUtils";

import {
  basePlaygroundSpan,
  spanAttributesWithInputMessages,
} from "./fixtures";

const expectedPlaygroundInstanceWithIO: PlaygroundInstance = {
  id: 0,
  activeRunId: null,
  isRunning: false,
  input: {
    variables: {},
  },
  template: {
    __type: "chat",
    messages: [
      { content: "You are a chatbot", role: ChatMessageRole.system },
      { content: "hello?", role: ChatMessageRole.user },
    ],
  },
  output: [{ content: "This is an AI Answer", role: ChatMessageRole.ai }],
  parsingErrors: [],
  tools: undefined,
};

describe("transformSpanAttributesToPlaygroundInstance", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
  });
  it("should throw if the attributes are not parsable", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: "invalid json",
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toStrictEqual({
      ...expectedPlaygroundInstanceWithIO,
      template: DEFAULT_CHAT_COMPLETION_TEMPLATE,
      output: undefined,
      parsingErrors: [SPAN_ATTRIBUTES_PARSING_ERROR],
    });
  });

  it("should return null if the attributes do not match the schema", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({}),
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toStrictEqual({
      ...expectedPlaygroundInstanceWithIO,
      template: DEFAULT_CHAT_COMPLETION_TEMPLATE,
      output: undefined,
      parsingErrors: [
        INPUT_MESSAGES_PARSING_ERROR,
        OUTPUT_MESSAGES_PARSING_ERROR,
        OUTPUT_VALUE_PARSING_ERROR,
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
      ...expectedPlaygroundInstanceWithIO,
      output: undefined,
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
      ...expectedPlaygroundInstanceWithIO,
      parsingErrors: [OUTPUT_MESSAGES_PARSING_ERROR],
      output: "This is an AI Answer",
    });
  });

  it("should return a PlaygroundInstance if the attributes contain llm.input_messages and output_messages", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify(spanAttributesWithInputMessages),
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      ...expectedPlaygroundInstanceWithIO,
    });
  });

  it("should normalize message roles in input and output messages", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({
        llm: {
          input_messages: [
            {
              message: {
                role: "human",
                content: "You are a chatbot",
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
      ...expectedPlaygroundInstanceWithIO,
      template: {
        __type: "chat",
        messages: [
          {
            role: "user",
            content: "You are a chatbot",
          },
        ],
      },
      output: [{ content: "This is an AI Answer", role: "ai" }],
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
