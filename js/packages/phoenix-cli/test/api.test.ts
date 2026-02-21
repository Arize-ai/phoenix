import { describe, expect, it } from "vitest";

import { isMutation, parseFields } from "../src/commands/api";

describe("parseFields", () => {
  it("parses a single key=value pair", () => {
    expect(parseFields({ fields: ["query=hello"] })).toEqual({
      query: "hello",
    });
  });

  it("parses multiple key=value pairs", () => {
    expect(
      parseFields({ fields: ["query=hello", "first=5", "after=cursor123"] })
    ).toEqual({ query: "hello", first: "5", after: "cursor123" });
  });

  it("splits only on the first = so values may contain =", () => {
    expect(parseFields({ fields: ["query=a=b=c"] })).toEqual({
      query: "a=b=c",
    });
  });

  it("throws when a field has no = sign", () => {
    expect(() => parseFields({ fields: ["badfield"] })).toThrow(
      'Invalid field format: "badfield". Expected key=value.'
    );
  });

  it("throws when the key is empty (=value)", () => {
    expect(() => parseFields({ fields: ["=value"] })).toThrow(
      'Invalid field format: "=value". Key must not be empty.'
    );
  });

  it("returns an empty record for an empty array", () => {
    expect(parseFields({ fields: [] })).toEqual({});
  });
});

describe("isMutation", () => {
  it("returns false for an anonymous shorthand query", () => {
    expect(isMutation({ query: "{ serverStatus { status } }" })).toBe(false);
  });

  it("returns false for a named query", () => {
    expect(
      isMutation({
        query: "query GetProjects { projects { edges { node { name } } } }",
      })
    ).toBe(false);
  });

  it("returns true for an anonymous mutation", () => {
    expect(
      isMutation({ query: 'mutation { createProject(name: "x") { id } }' })
    ).toBe(true);
  });

  it("returns true for a named mutation", () => {
    expect(
      isMutation({
        query:
          "mutation CreateProject($name: String!) { createProject(name: $name) { id } }",
      })
    ).toBe(true);
  });

  it("returns true for a mutation with variables block", () => {
    expect(
      isMutation({
        query:
          "mutation($input: CreateInput!) { create(input: $input) { id } }",
      })
    ).toBe(true);
  });

  it("returns false when 'mutation' appears only in a # comment", () => {
    expect(
      isMutation({
        query: "# mutation DoSomething\n{ serverStatus { status } }",
      })
    ).toBe(false);
  });

  it("returns false when 'mutation' is part of a field name", () => {
    expect(isMutation({ query: "{ mutationLog { id type } }" })).toBe(false);
  });

  it("returns true for mutation with leading whitespace", () => {
    expect(isMutation({ query: "  mutation { x }" })).toBe(true);
  });
});
