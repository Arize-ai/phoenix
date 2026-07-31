import type {
  PlaygroundChatTemplate,
  PlaygroundInstance,
} from "@phoenix/store/playground";

import { instanceToPromptVersion } from "../fetchPlaygroundPrompt";
import { getVariablesMapFromInstances } from "../playgroundUtils";
import { promptTemplateToPlaygroundMessages } from "../promptConfigToPlaygroundInstance";

const PDF_URL = `phoenix://media/${"c".repeat(64)}`;
const IMAGE_URL = `phoenix://media/${"a".repeat(64)}`;

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
      modelName: "gemini-3.5-flash",
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

describe("saving a message with documents", () => {
  it("sends the text first and then each document", () => {
    const promptVersion = instanceToPromptVersion({
      instance: chatInstance([
        {
          id: 1,
          role: "user",
          content: "summarise this",
          files: [{ file: { url: PDF_URL, mediaType: "application/pdf" } }],
        },
      ]),
      templateFormat: "MUSTACHE",
    });

    expect(promptVersion?.template.messages[0]?.content).toEqual([
      { text: { text: "summarise this" } },
      { file: { url: PDF_URL, mediaType: "application/pdf" } },
    ]);
  });

  it("names a document variable rather than storing one", () => {
    const promptVersion = instanceToPromptVersion({
      instance: chatInstance([
        {
          id: 1,
          role: "user",
          content: "summarise this",
          fileVariables: [{ file: { variable: "contract" } }],
        },
      ]),
      templateFormat: "MUSTACHE",
    });

    expect(promptVersion?.template.messages[0]?.content).toEqual([
      { text: { text: "summarise this" } },
      { fileVariable: { variable: "contract" } },
    ]);
  });

  /**
   * A message can carry both kinds at once, and the two must not collapse into
   * each other on the way out — a provider needs an image on its image channel and
   * a document on its document channel.
   */
  it("keeps an image and a document distinct in one message", () => {
    const promptVersion = instanceToPromptVersion({
      instance: chatInstance([
        {
          id: 1,
          role: "user",
          content: "does the photo match the contract?",
          images: [{ image: { url: IMAGE_URL, mediaType: "image/png" } }],
          files: [{ file: { url: PDF_URL, mediaType: "application/pdf" } }],
        },
      ]),
      templateFormat: "MUSTACHE",
    });

    expect(promptVersion?.template.messages[0]?.content).toEqual([
      { text: { text: "does the photo match the contract?" } },
      { image: { url: IMAGE_URL, mediaType: "image/png" } },
      { file: { url: PDF_URL, mediaType: "application/pdf" } },
    ]);
  });
});

describe("loading a message with documents", () => {
  it("loads a stored document off a saved prompt", () => {
    const messages = promptTemplateToPlaygroundMessages({
      template: {
        __typename: "PromptChatTemplate",
        messages: [
          {
            role: "USER",
            content: [
              { text: { text: "summarise this" } },
              { file: { url: PDF_URL, mediaType: "application/pdf" } },
            ],
          },
        ],
      },
      provider: "GOOGLE",
    });

    expect(messages[0]?.content).toBe("summarise this");
    expect(messages[0]?.files).toEqual([
      { file: { url: PDF_URL, mediaType: "application/pdf" } },
    ]);
    expect(messages[0]?.fileVariables).toBeUndefined();
  });

  it("loads a document variable off a saved prompt", () => {
    const messages = promptTemplateToPlaygroundMessages({
      template: {
        __typename: "PromptChatTemplate",
        messages: [
          {
            role: "USER",
            content: [
              { text: { text: "summarise this" } },
              { file: { variable: "contract" } },
            ],
          },
        ],
      },
      provider: "GOOGLE",
    });

    expect(messages[0]?.fileVariables).toEqual([
      { file: { variable: "contract" } },
    ]);
    expect(messages[0]?.files).toBeUndefined();
  });

  /**
   * The regression this guards: loading a prompt and saving it straight back has
   * to return the same template. A read path that drops the document silently
   * erases it on the next save.
   */
  it("round-trips every kind of media in one message", () => {
    const loaded = promptTemplateToPlaygroundMessages({
      template: {
        __typename: "PromptChatTemplate",
        messages: [
          {
            role: "USER",
            content: [
              { text: { text: "compare" } },
              { image: { url: IMAGE_URL, mediaType: "image/png" } },
              { image: { variable: "photo" } },
              { file: { url: PDF_URL, mediaType: "application/pdf" } },
              { file: { variable: "contract" } },
            ],
          },
        ],
      },
      provider: "GOOGLE",
    });

    expect(loaded[0]?.images).toHaveLength(1);
    expect(loaded[0]?.imageVariables).toHaveLength(1);
    expect(loaded[0]?.files).toHaveLength(1);
    expect(loaded[0]?.fileVariables).toHaveLength(1);

    const promptVersion = instanceToPromptVersion({
      instance: chatInstance(loaded),
      templateFormat: "MUSTACHE",
    });

    expect(promptVersion?.template.messages[0]?.content).toEqual([
      { text: { text: "compare" } },
      { image: { url: IMAGE_URL, mediaType: "image/png" } },
      { imageVariable: { variable: "photo" } },
      { file: { url: PDF_URL, mediaType: "application/pdf" } },
      { fileVariable: { variable: "contract" } },
    ]);
  });
});

describe("document variable derivation", () => {
  it("surfaces a document variable as a playground input, tagged as a file", () => {
    const { variableKeys, mediaVariableKeys, mediaVariableKinds } =
      getVariablesMapFromInstances({
        instances: [
          chatInstance([
            {
              id: 1,
              role: "user",
              content: "in {{sentences}} sentences",
              fileVariables: [{ file: { variable: "contract" } }],
            },
          ]),
        ],
        templateFormat: "MUSTACHE",
        input: { variablesValueCache: {} },
      });

    expect(variableKeys).toEqual(["sentences", "contract"]);
    expect(mediaVariableKeys).toEqual(["contract"]);
    // The kind drives which picker the Inputs panel shows, so it has to survive.
    expect(mediaVariableKinds).toEqual({ contract: "file" });
  });

  it("tags each media variable with its own kind", () => {
    const { mediaVariableKeys, mediaVariableKinds } =
      getVariablesMapFromInstances({
        instances: [
          chatInstance([
            {
              id: 1,
              role: "user",
              content: "",
              imageVariables: [{ image: { variable: "photo" } }],
              fileVariables: [{ file: { variable: "contract" } }],
            },
          ]),
        ],
        templateFormat: "MUSTACHE",
        input: { variablesValueCache: {} },
      });

    expect(mediaVariableKeys).toEqual(["photo", "contract"]);
    expect(mediaVariableKinds).toEqual({
      photo: "image",
      contract: "file",
    });
  });

  it("keeps document variables when the template format is NONE", () => {
    const { variableKeys, mediaVariableKinds } = getVariablesMapFromInstances({
      instances: [
        chatInstance([
          {
            id: 1,
            role: "user",
            content: "no {{substitution}} here",
            fileVariables: [{ file: { variable: "contract" } }],
          },
        ]),
      ],
      templateFormat: "NONE",
      input: { variablesValueCache: {} },
    });

    expect(variableKeys).toEqual(["contract"]);
    expect(mediaVariableKinds).toEqual({ contract: "file" });
  });

  it("reports no media variable for a stored document", () => {
    const { mediaVariableKeys } = getVariablesMapFromInstances({
      instances: [
        chatInstance([
          {
            id: 1,
            role: "user",
            content: "",
            files: [{ file: { url: PDF_URL, mediaType: "application/pdf" } }],
          },
        ]),
      ],
      templateFormat: "MUSTACHE",
      input: { variablesValueCache: {} },
    });

    expect(mediaVariableKeys).toEqual([]);
  });
});
