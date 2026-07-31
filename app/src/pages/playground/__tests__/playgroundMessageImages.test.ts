import type {
  PlaygroundChatTemplate,
  PlaygroundInstance,
} from "@phoenix/store/playground";

import { instanceToPromptVersion } from "../fetchPlaygroundPrompt";
import { getVariablesMapFromInstances } from "../playgroundUtils";
import { promptTemplateToPlaygroundMessages } from "../promptConfigToPlaygroundInstance";

const DIGEST = "a".repeat(64);
const IMAGE_URL = `phoenix://media/${DIGEST}`;

function chatInstance(
  messages: PlaygroundChatTemplate["messages"]
): PlaygroundInstance {
  return {
    id: 1,
    template: { __type: "chat", messages },
    tools: [],
    toolChoice: null,
    model: {
      provider: "GOOGLE",
      modelName: "gemini-2.5-flash",
      customProvider: null,
      responseFormat: null,
      invocationParameters: {},
    },
    repetitions: {
      1: {
        output: null,
        toolCalls: {},
        spanId: null,
        error: null,
        status: "notStarted",
      },
    },
    activeRunId: null,
    selectedRepetitionNumber: 1,
  } as PlaygroundInstance;
}

describe("saving a message with images", () => {
  it("sends the text first and then each image", () => {
    const promptVersion = instanceToPromptVersion({
      instance: chatInstance([
        {
          id: 1,
          role: "user",
          content: "what is in this?",
          images: [{ image: { url: IMAGE_URL, mediaType: "image/png" } }],
        },
      ]),
      templateFormat: "MUSTACHE",
    });

    expect(promptVersion).not.toBeNull();
    expect(promptVersion?.template.messages[0]?.content).toEqual([
      { text: { text: "what is in this?" } },
      { image: { url: IMAGE_URL, mediaType: "image/png" } },
    ]);
  });

  it("preserves the order of several images", () => {
    const second = `phoenix://media/${"b".repeat(64)}`;
    const promptVersion = instanceToPromptVersion({
      instance: chatInstance([
        {
          id: 1,
          role: "user",
          content: "compare these",
          images: [
            { image: { url: IMAGE_URL, mediaType: "image/png" } },
            { image: { url: second, mediaType: "image/jpeg" } },
          ],
        },
      ]),
      templateFormat: "MUSTACHE",
    });

    expect(
      promptVersion?.template.messages[0]?.content.map((part) =>
        part.image ? part.image.url : "text"
      )
    ).toEqual(["text", IMAGE_URL, second]);
  });

  it("keeps images on a message that has no text", () => {
    const promptVersion = instanceToPromptVersion({
      instance: chatInstance([
        {
          id: 1,
          role: "user",
          content: "",
          images: [{ image: { url: IMAGE_URL, mediaType: "image/png" } }],
        },
      ]),
      templateFormat: "MUSTACHE",
    });

    expect(promptVersion?.template.messages[0]?.content).toEqual([
      { image: { url: IMAGE_URL, mediaType: "image/png" } },
    ]);
  });

  it("omits the images field entirely when a message has none", () => {
    const promptVersion = instanceToPromptVersion({
      instance: chatInstance([{ id: 1, role: "user", content: "just text" }]),
      templateFormat: "MUSTACHE",
    });

    expect(promptVersion?.template.messages[0]?.content).toEqual([
      { text: { text: "just text" } },
    ]);
  });
});

describe("loading a prompt with images", () => {
  it("splits text into content and images into the attachment list", () => {
    const messages = promptTemplateToPlaygroundMessages({
      template: {
        __typename: "PromptChatTemplate",
        messages: [
          {
            role: "USER",
            content: [
              { text: { text: "describe this" } },
              { image: { url: IMAGE_URL, mediaType: "image/png" } },
            ],
          },
        ],
      },
      provider: "GOOGLE",
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe("describe this");
    expect(messages[0]?.images).toEqual([
      { image: { url: IMAGE_URL, mediaType: "image/png" } },
    ]);
  });

  it("round-trips an image through load and save", () => {
    const loaded = promptTemplateToPlaygroundMessages({
      template: {
        __typename: "PromptChatTemplate",
        messages: [
          {
            role: "USER",
            content: [
              { text: { text: "hello" } },
              { image: { url: IMAGE_URL, mediaType: "image/webp" } },
            ],
          },
        ],
      },
      provider: "GOOGLE",
    });

    const promptVersion = instanceToPromptVersion({
      instance: chatInstance(loaded),
      templateFormat: "MUSTACHE",
    });

    expect(promptVersion?.template.messages[0]?.content).toEqual([
      { text: { text: "hello" } },
      { image: { url: IMAGE_URL, mediaType: "image/webp" } },
    ]);
  });

  it("leaves images undefined when a prompt has none", () => {
    const messages = promptTemplateToPlaygroundMessages({
      template: {
        __typename: "PromptChatTemplate",
        messages: [{ role: "USER", content: [{ text: { text: "hi" } }] }],
      },
      provider: "GOOGLE",
    });

    expect(messages[0]?.images).toBeUndefined();
  });
});

describe("image variables", () => {
  it("declares an image variable on save", () => {
    const promptVersion = instanceToPromptVersion({
      instance: chatInstance([
        {
          id: 1,
          role: "user",
          content: "Describe this, focusing on {{aspect}}.",
          imageVariables: [{ image: { variable: "question_image" } }],
        },
      ]),
      templateFormat: "MUSTACHE",
    });

    expect(promptVersion?.template.messages[0]?.content).toEqual([
      { text: { text: "Describe this, focusing on {{aspect}}." } },
      { imageVariable: { variable: "question_image" } },
    ]);
  });

  it("loads an image variable off a saved prompt", () => {
    const messages = promptTemplateToPlaygroundMessages({
      template: {
        __typename: "PromptChatTemplate",
        messages: [
          {
            role: "USER",
            content: [
              { text: { text: "describe this" } },
              { image: { variable: "question_image" } },
            ],
          },
        ],
      },
      provider: "GOOGLE",
    });

    expect(messages[0]?.content).toBe("describe this");
    expect(messages[0]?.imageVariables).toEqual([
      { image: { variable: "question_image" } },
    ]);
    expect(messages[0]?.images).toBeUndefined();
  });

  it("round-trips a variable and a stored image side by side", () => {
    const loaded = promptTemplateToPlaygroundMessages({
      template: {
        __typename: "PromptChatTemplate",
        messages: [
          {
            role: "USER",
            content: [
              { text: { text: "compare" } },
              { image: { url: IMAGE_URL, mediaType: "image/png" } },
              { image: { variable: "answer_image" } },
            ],
          },
        ],
      },
      provider: "GOOGLE",
    });

    expect(loaded[0]?.images).toHaveLength(1);
    expect(loaded[0]?.imageVariables).toHaveLength(1);

    const promptVersion = instanceToPromptVersion({
      instance: chatInstance(loaded),
      templateFormat: "MUSTACHE",
    });

    expect(promptVersion?.template.messages[0]?.content).toEqual([
      { text: { text: "compare" } },
      { image: { url: IMAGE_URL, mediaType: "image/png" } },
      { imageVariable: { variable: "answer_image" } },
    ]);
  });
});

describe("media variable derivation", () => {
  const instanceWith = (messages: PlaygroundChatTemplate["messages"]) =>
    chatInstance(messages);

  it("surfaces image variables as playground inputs", () => {
    const { variableKeys, mediaVariableKeys } = getVariablesMapFromInstances({
      instances: [
        instanceWith([
          {
            id: 1,
            role: "user",
            content: "focus on {{aspect}}",
            imageVariables: [{ image: { variable: "question_image" } }],
          },
        ]),
      ],
      templateFormat: "MUSTACHE",
      input: { variablesValueCache: {} },
    });

    expect(variableKeys).toEqual(["aspect", "question_image"]);
    expect(mediaVariableKeys).toEqual(["question_image"]);
  });

  it("keeps image variables even when the template format is NONE", () => {
    /** They are declared by a message part, not by template syntax. */
    const { variableKeys, mediaVariableKeys } = getVariablesMapFromInstances({
      instances: [
        instanceWith([
          {
            id: 1,
            role: "user",
            content: "no {{substitution}} here",
            imageVariables: [{ image: { variable: "question_image" } }],
          },
        ]),
      ],
      templateFormat: "NONE",
      input: { variablesValueCache: {} },
    });

    expect(variableKeys).toEqual(["question_image"]);
    expect(mediaVariableKeys).toEqual(["question_image"]);
  });

  it("deduplicates a variable used in more than one message", () => {
    const { mediaVariableKeys } = getVariablesMapFromInstances({
      instances: [
        instanceWith([
          {
            id: 1,
            role: "user",
            content: "",
            imageVariables: [{ image: { variable: "shared" } }],
          },
          {
            id: 2,
            role: "user",
            content: "",
            imageVariables: [{ image: { variable: "shared" } }],
          },
        ]),
      ],
      templateFormat: "MUSTACHE",
      input: { variablesValueCache: {} },
    });

    expect(mediaVariableKeys).toEqual(["shared"]);
  });

  it("reports no media variables for a stored image", () => {
    const { mediaVariableKeys } = getVariablesMapFromInstances({
      instances: [
        instanceWith([
          {
            id: 1,
            role: "user",
            content: "",
            images: [{ image: { url: IMAGE_URL, mediaType: "image/png" } }],
          },
        ]),
      ],
      templateFormat: "MUSTACHE",
      input: { variablesValueCache: {} },
    });

    expect(mediaVariableKeys).toEqual([]);
  });
});
