import { describe, expect, it } from "vitest";

import { isNonQuery } from "../src/commands/api";

describe("isNonQuery", () => {
  it("returns false for an anonymous shorthand query", () => {
    expect(
      isNonQuery({ query: "{ serverStatus { insufficientStorage } }" })
    ).toBe(false);
  });

  it("returns false for a named query", () => {
    expect(
      isNonQuery({
        query: "query GetProjects { projects { edges { node { name } } } }",
      })
    ).toBe(false);
  });

  it("returns true for an anonymous mutation", () => {
    expect(
      isNonQuery({ query: 'mutation { createProject(name: "x") { id } }' })
    ).toBe(true);
  });

  it("returns true for a named mutation", () => {
    expect(
      isNonQuery({
        query:
          "mutation CreateProject($name: String!) { createProject(name: $name) { id } }",
      })
    ).toBe(true);
  });

  it("returns true for a mutation with variables block", () => {
    expect(
      isNonQuery({
        query:
          "mutation($input: CreateInput!) { create(input: $input) { id } }",
      })
    ).toBe(true);
  });

  it("returns true for an anonymous subscription", () => {
    expect(isNonQuery({ query: "subscription { events { id } }" })).toBe(true);
  });

  it("returns true for a named subscription", () => {
    expect(
      isNonQuery({ query: "subscription OnEvent { events { id type } }" })
    ).toBe(true);
  });

  it("returns false when 'mutation' appears only in a # comment", () => {
    expect(
      isNonQuery({
        query:
          "# mutation DoSomething\n{ serverStatus { insufficientStorage } }",
      })
    ).toBe(false);
  });

  it("returns false when 'subscription' appears only in a # comment", () => {
    expect(
      isNonQuery({
        query:
          "# subscription OnEvent\n{ projects { edges { node { name } } } }",
      })
    ).toBe(false);
  });

  it("returns false when 'mutation' is part of a field name", () => {
    expect(isNonQuery({ query: "{ mutationLog { id type } }" })).toBe(false);
  });

  it("returns true for mutation with leading whitespace", () => {
    expect(isNonQuery({ query: "  mutation { x }" })).toBe(true);
  });

  it("returns true for subscription with leading whitespace", () => {
    expect(isNonQuery({ query: "  subscription { x }" })).toBe(true);
  });
});
