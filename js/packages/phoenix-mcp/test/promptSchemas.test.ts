import { describe, expect, it } from "vitest";

import { createPromptSchema } from "../src/promptSchemas";

/**
 * Server-side prompt name identifier pattern.
 *
 * Mirrors `Identifier` in `src/phoenix/db/types/identifier.py`, which the
 * `POST /v1/prompts` request body validates `name` against.
 */
const SERVER_IDENTIFIER_PATTERN = /^[a-z0-9]([_a-z0-9-]*[a-z0-9])?$/;

const normalizeName = (name: string): string =>
  createPromptSchema.parse({ name, template: "hello" }).name;

describe("createPromptSchema name normalization", () => {
  it("keeps dashes, which the server identifier pattern allows", () => {
    expect(normalizeName("article-summarizer")).toBe("article-summarizer");
  });

  it("leaves an already-valid identifier untouched", () => {
    expect(normalizeName("email_generator")).toBe("email_generator");
  });

  it("lowercases and joins whitespace runs with underscores", () => {
    expect(normalizeName("My  Prompt")).toBe("my_prompt");
  });

  it("drops characters outside the identifier set", () => {
    expect(normalizeName("foo!bar?")).toBe("foobar");
  });

  it("trims leading and trailing separators", () => {
    expect(normalizeName("_draft")).toBe("draft");
    expect(normalizeName("draft-")).toBe("draft");
    expect(normalizeName("--my-prompt__")).toBe("my-prompt");
  });

  it.each([
    "article-summarizer",
    "email_generator",
    "My  Prompt",
    "foo!bar?",
    "_draft",
    "draft-",
    "--my-prompt__",
    "  spaced out name  ",
    "Résumé Reviewer",
  ])("produces a server-valid identifier for %j", (name) => {
    expect(normalizeName(name)).toMatch(SERVER_IDENTIFIER_PATTERN);
  });

  it("rejects a name with no identifier characters left", () => {
    expect(() => normalizeName("!!!")).toThrow();
  });
});
