import { _resetInstanceId, _resetMessageId } from "@phoenix/store";

import {
  getChatRole,
  transformSpanAttributesToPlaygroundInstance,
} from "../playgroundUtils";

import {
  basePlaygroundSpan,
  spanAttributesWithInputMessages,
} from "./fixtures";

const expectedPlaygroundInstance = {
  id: 0,
  activeRunId: null,
  isRunning: false,
  input: {
    variables: {},
  },
  template: {
    __type: "chat",
    messages: spanAttributesWithInputMessages.llm.input_messages.map(
      ({ message }, index) => {
        return {
          id: index,
          ...message,
        };
      }
    ),
  },
  output: spanAttributesWithInputMessages.llm.output_messages,
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
    expect(() => transformSpanAttributesToPlaygroundInstance(span)).toThrow(
      "Invalid span attributes, attributes must be valid JSON"
    );
  });

  it("should return null if the attributes do not match the schema", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify({}),
    };
    expect(transformSpanAttributesToPlaygroundInstance(span)).toBeNull();
  });

  it("should return a PlaygroundInstance if the attributes contain llm.input_messages", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: JSON.stringify(spanAttributesWithInputMessages),
    };

    const instance = transformSpanAttributesToPlaygroundInstance(span);
    expect(instance?.template.__type).toEqual("chat");
    if (instance?.template.__type !== "chat") {
      throw new Error("Invalid template type constructed");
    }
    expect(instance?.template.messages).toHaveLength(2);
    instance?.template.messages.forEach((message, index) => {
      expect(message.role).toEqual(
        expectedPlaygroundInstance.template.messages[index].role
      );
      expect(message.content).toEqual(
        expectedPlaygroundInstance.template.messages[index].content
      );
    });
  });
  it("should return a PlaygroundInstance if the attributes contain llm.input_messages, even if output_messages are not present", () => {
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
    const instance = transformSpanAttributesToPlaygroundInstance(span);
    expect(instance?.template.__type).toEqual("chat");
    if (instance?.template.__type !== "chat") {
      throw new Error("Invalid template type constructed");
    }
    expect(Array.isArray(instance?.template.messages)).toBeTruthy();
  });
});

describe("getChatRole", () => {
  it("should return the role if it is a valid ChatMessageRole", () => {
    expect(getChatRole("user")).toEqual("user");
  });

  it("should return the ChatMessageRole if the role is included in ChatRoleMap", () => {
    expect(getChatRole("assistant")).toEqual("ai");
    // expect(getChatRole("bot")).toEqual("ai");
    // expect(getChatRole("system")).toEqual("system");
    // expect(getChatRole("human:")).toEqual("user");
  });

  it("should return DEFAULT_CHAT_ROLE if the role is not found", () => {
    expect(getChatRole("invalid")).toEqual("user");
  });
});
