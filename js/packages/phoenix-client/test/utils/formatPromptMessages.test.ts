import { TextPart } from "../../src/schemas/llm/phoenixPrompt/messagePartSchemas";
import { PromptChatMessage } from "../../src/types/prompts";
import { formatPromptMessages } from "../../src/utils/formatPromptMessages";

import { describe, expect, it } from "vitest";

describe("formatPromptMessages", () => {
  it("should only format TextPart content", () => {
    const messages: PromptChatMessage[] = [
      {
        role: "user",
        content: [{ type: "text", text: "Hello {{name}}" } as TextPart],
      },
    ];

    const formatted = formatPromptMessages("MUSTACHE", messages, {
      name: "World",
    });
    expect(formatted?.[0]?.content?.[0]).toEqual({
      type: "text",
      text: "Hello World",
    });
  });

  describe("MUSTACHE format", () => {
    it("should replace single variable", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "user",
          content: [{ type: "text", text: "Hello {{name}}" }],
        },
      ];

      const formatted = formatPromptMessages("MUSTACHE", messages, {
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: "Hello World",
      });
    });

    it("should replace multiple variables", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "{{greeting}} there, {{name}}!",
            },
          ],
        },
      ];

      const formatted = formatPromptMessages("MUSTACHE", messages, {
        greeting: "Hello",
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: "Hello there, World!",
      });
    });

    it("should support string content", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "user",
          content: "Hello {{firstName}} {{lastName}}",
        },
      ];

      const formatted = formatPromptMessages("MUSTACHE", messages, {
        firstName: "John",
        lastName: "Doe",
      });
      expect(formatted?.[0]?.content).toEqual("Hello John Doe");
    });

    it("should replace multiple instances of same variable", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "user",
          content: [{ type: "text", text: "{{name}}, {{name}}!" }],
        },
      ];

      const formatted = formatPromptMessages("MUSTACHE", messages, {
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: "World, World!",
      });
    });

    it("should handle escaped mustache syntax", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Hello {{name}}, use {{{escaped}}} {{name}}",
            },
          ],
        },
      ];

      const formatted = formatPromptMessages("MUSTACHE", messages, {
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: "Hello World, use {{{escaped}}} World",
      });
    });

    it("should ignore whitespace in variable names", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Hello {{ name }}! {{name}} is a good name!",
            },
          ],
        },
      ];

      const formatted = formatPromptMessages("MUSTACHE", messages, {
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: "Hello World! World is a good name!",
      });
    });
  });

  describe("F_STRING format", () => {
    it("should replace single variable", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "user",
          content: [{ type: "text", text: "Hello {name}" }],
        },
      ];

      const formatted = formatPromptMessages("F_STRING", messages, {
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: "Hello World",
      });
    });

    it("should replace multiple variables", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "user",
          content: [{ type: "text", text: "{greeting} there, {name}!" }],
        },
      ];

      const formatted = formatPromptMessages("F_STRING", messages, {
        greeting: "Hello",
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: "Hello there, World!",
      });
    });

    it("should support string content", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "user",
          content: "Hello {firstName} {lastName}",
        },
      ];

      const formatted = formatPromptMessages("F_STRING", messages, {
        firstName: "John",
        lastName: "Doe",
      });
      expect(formatted?.[0]?.content).toEqual("Hello John Doe");
    });

    it("should replace multiple instances of same variable", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "user",
          content: [{ type: "text", text: "{name}, {name}!" }],
        },
      ];

      const formatted = formatPromptMessages("F_STRING", messages, {
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: "World, World!",
      });
    });

    it("should handle escaped fstring syntax", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Hello {name}, use {{escaped}} {name}",
            },
          ],
        },
      ];

      const formatted = formatPromptMessages("F_STRING", messages, {
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: "Hello World, use {{escaped}} World",
      });
    });

    it("should ignore whitespace in variable names", () => {
      const messages: PromptChatMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Hello { name }! {name} is a good name!" },
          ],
        },
      ];

      const formatted = formatPromptMessages("F_STRING", messages, {
        name: "World",
      });
      expect(formatted?.[0]?.content?.[0]).toEqual({
        type: "text",
        text: "Hello World! World is a good name!",
      });
    });
  });

  it("should not modify text when format is NONE", () => {
    const messages: PromptChatMessage[] = [
      {
        role: "user",
        content: [{ type: "text", text: "Hello {name} {{name}}" }],
      },
      {
        role: "ai",
        content: [{ type: "text", text: "Hello {name} {{name}}" }],
      },
    ];

    const formatted = formatPromptMessages("NONE", messages, {
      name: "World",
    });
    expect(formatted?.[0]?.content?.[0]).toEqual({
      type: "text",
      text: "Hello {name} {{name}}",
    });
    expect(formatted?.[1]?.content?.[0]).toEqual({
      type: "text",
      text: "Hello {name} {{name}}",
    });
  });
});
