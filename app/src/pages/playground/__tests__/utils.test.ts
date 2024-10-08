import { resetInstanceId } from "@phoenix/store";

import { transformSpanAttributesToPlaygroundInstance } from "../utils";

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
      ({ message }) => message
    ),
  },
  output: spanAttributesWithInputMessages.llm.output_messages,
  tools: undefined,
};

describe("transformSpanAttributesToPlaygroundInstance", () => {
  beforeEach(() => {
    resetInstanceId();
  });
  it("should throw if the attributes are not parsable", () => {
    const span = {
      ...basePlaygroundSpan,
      attributes: "invalid json",
    };
    expect(() => transformSpanAttributesToPlaygroundInstance(span)).toThrow(
      "Invalid attributes"
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

    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual(
      expectedPlaygroundInstance
    );
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
    expect(transformSpanAttributesToPlaygroundInstance(span)).toEqual({
      ...expectedPlaygroundInstance,
      output: undefined,
    });
  });
});
