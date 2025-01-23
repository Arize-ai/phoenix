import { describe, it, expect } from "vitest";
import { promptMessageFormatter } from "../src/utils/promptMessageFormatter";
import { PromptChatMessage } from "../src/types/prompts";
import { TextPart } from "../src/schemas/llm/promptSchemas";

describe("promptMessageFormatter", () => {
  it("should only format TextPart content", () => {
    const messages: PromptChatMessage[] = [
      {
        role: "USER",
        content: [
          { type: "text", text: { text: "Hello {{name}}" } } as TextPart,
          { type: "image", image: { url: "test.jpg" } },
        ],
      },
    ];

    const formatted = promptMessageFormatter("MUSTACHE", messages, {
      name: "World",
    });
    expect(formatted?.[0]?.content?.[0]).toEqual({
      type: "text",
      text: { text: "Hello World" },
    });
    expect(formatted?.[0]?.content?.[1]).toEqual({
      type: "image",
      image: { url: "test.jpg" },
    });
  });

  describe("MUSTACHE format", () => {
    it("should replace single variable", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "USER",
          content: [{ type: "text", text: { text: "Hello {{name}}" } }],
        },
      ];

      const formatted = promptMessageFormatter("MUSTACHE", messages, {
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: { text: "Hello World" },
      });
    });

    it("should replace multiple variables", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "USER",
          content: [
            {
              type: "text",
              text: { text: "{{greeting}} there, {{name}}!" },
            },
          ],
        },
      ];

      const formatted = promptMessageFormatter("MUSTACHE", messages, {
        greeting: "Hello",
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: { text: "Hello there, World!" },
      });
    });

    it("should replace multiple instances of same variable", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "USER",
          content: [{ type: "text", text: { text: "{{name}}, {{name}}!" } }],
        },
      ];

      const formatted = promptMessageFormatter("MUSTACHE", messages, {
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: { text: "World, World!" },
      });
    });

    it("should handle escaped mustache syntax", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "USER",
          content: [
            {
              type: "text",
              text: { text: "Hello {{name}}, use {{{escaped}}} {{name}}" },
            },
          ],
        },
      ];

      const formatted = promptMessageFormatter("MUSTACHE", messages, {
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: { text: "Hello World, use {{{escaped}}} World" },
      });
    });
  });

  describe("FSTRING format", () => {
    it("should replace single variable", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "USER",
          content: [{ type: "text", text: { text: "Hello {name}" } }],
        },
      ];

      const formatted = promptMessageFormatter("FSTRING", messages, {
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: { text: "Hello World" },
      });
    });

    it("should replace multiple variables", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "USER",
          content: [
            { type: "text", text: { text: "{greeting} there, {name}!" } },
          ],
        },
      ];

      const formatted = promptMessageFormatter("FSTRING", messages, {
        greeting: "Hello",
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: { text: "Hello there, World!" },
      });
    });

    it("should replace multiple instances of same variable", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "USER",
          content: [{ type: "text", text: { text: "{name}, {name}!" } }],
        },
      ];

      const formatted = promptMessageFormatter("FSTRING", messages, {
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: { text: "World, World!" },
      });
    });

    it("should handle escaped fstring syntax", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "USER",
          content: [
            {
              type: "text",
              text: { text: "Hello {name}, use {{escaped}} {name}" },
            },
          ],
        },
      ];

      const formatted = promptMessageFormatter("FSTRING", messages, {
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: { text: "Hello World, use {{escaped}} World" },
      });
    });
  });

  it("should not modify text when format is NONE", () => {
    const messages: PromptChatMessage[] = [
      {
        role: "USER",
        content: [{ type: "text", text: { text: "Hello {name} {{name}}" } }],
      },
      {
        role: "AI",
        content: [{ type: "text", text: { text: "Hello {name} {{name}}" } }],
      },
    ];

    const formatted = promptMessageFormatter("NONE", messages, {
      name: "World",
    });
    expect(formatted?.[0]?.content?.[0]).toEqual({
      type: "text",
      text: { text: "Hello {name} {{name}}" },
    });
    expect(formatted?.[1]?.content?.[0]).toEqual({
      type: "text",
      text: { text: "Hello {name} {{name}}" },
    });
  });
});
