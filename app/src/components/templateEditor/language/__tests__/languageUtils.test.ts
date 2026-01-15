import { formatFString, FStringTemplatingLanguage } from "../fString";
import { extractVariables } from "../languageUtils";
import {
  formatMustacheLike,
  MustacheLikeTemplatingLanguage,
} from "../mustacheLike";

describe("language utils", () => {
  it("should extract variable names from a mustache-like template", () => {
    const tests = [
      { input: "{{name}}", expected: ["name"] },
      // TODO: add support for triple mustache escaping or at least use the inner most mustache as value
      // { input: "{{name}} {{{age}}}", expected: ["name"] },
      {
        input:
          "Hi I'm {{name}} and I'm {{age}} years old and I live in {{city}}",
        expected: ["name", "age", "city"],
      },
      {
        input: `
hi there {{name}}
how are you?

can you help with this json?

{ "name": "John", "age": {{age}} }`,
        expected: ["name", "age"],
      },
      {
        input: `{"name": "{{name}}", "age": {{age}}}`,
        expected: ["name", "age"],
      },
      {
        input: `{"name": "\\{{name}}", "age": \\{{age}}}`,
        expected: [],
      },
      {
        input: `{"name": "{{{name}}}"}`,
        expected: ["{name}"],
      },
      {
        input: `{"name": "{{  name  }}"}`,
        expected: ["name"],
      },
      // Dot notation tests
      {
        input: "{{user.name}}",
        expected: ["user.name"],
      },
      {
        input: "{{input.query}} and {{reference.answer}}",
        expected: ["input.query", "reference.answer"],
      },
      // Array indexing tests
      {
        input: "{{items[0]}}",
        expected: ["items[0]"],
      },
      {
        input: "{{messages[0].content}}",
        expected: ["messages[0].content"],
      },
      // Combined dot notation and array indexing
      {
        input: "{{input.messages[0].content}}",
        expected: ["input.messages[0].content"],
      },
      {
        input:
          "User: {{input.messages[0].content}}\nExpected: {{reference.answer}}",
        expected: ["input.messages[0].content", "reference.answer"],
      },
    ] as const;
    tests.forEach(({ input, expected }) => {
      expect(
        extractVariables({
          parser: MustacheLikeTemplatingLanguage.parser,
          text: input,
        })
      ).toEqual(expected);
    });
  });

  it("should extract variable names from a f-string template", () => {
    const tests = [
      { input: "{name}", expected: ["name"] },
      { input: "{name} {age}", expected: ["name", "age"] },
      { input: "{name} {{age}}", expected: ["name"] },
      {
        input: "Hi I'm {name} and I'm {age} years old and I live in {city}",
        expected: ["name", "age", "city"],
      },
      {
        input: `
hi there {name}
how are you?

can you help with this json?

{{ "name": "John", "age": {age} }}`,
        expected: ["name", "age"],
      },
      { input: "\\{test}", expected: [] },
    ] as const;
    tests.forEach(({ input, expected }) => {
      expect(
        extractVariables({
          parser: FStringTemplatingLanguage.parser,
          text: input,
        })
      ).toEqual(expected);
    });
  });

  it("should format a mustache-like template", () => {
    const tests = [
      {
        input: "{{name}}",
        variables: { name: "John" },
        expected: "John",
      },
      {
        input: "Hi {{name}}, this is bad syntax {{}}",
        variables: { name: "John", age: 30 },
        expected: "Hi John, this is bad syntax {{}}",
      },
      {
        input: "{{name}} {{age}}",
        variables: { name: "John", age: 30 },
        expected: "John 30",
      },
      {
        input: "{{name}} {age} {{city}}",
        variables: { name: "John", city: "New York" },
        expected: "John {age} New York",
      },
      {
        input: `
hi there {{name}}
how are you?

can you help with this json?

{ "name": "John", "age": {{age}} }`,
        variables: { name: "John", age: 30 },
        expected: `
hi there John
how are you?

can you help with this json?

{ "name": "John", "age": 30 }`,
      },
      {
        input: `{"name": "{{name}}", "age": {{age}}}`,
        variables: { name: "John", age: 30 },
        expected: `{"name": "John", "age": 30}`,
      },
      {
        input: `{"name": "\\{{name}}", "age": "{{age\\}}"}`,
        variables: { name: "John", age: 30 },
        expected: `{"name": "{{name}}", "age": "{{age\\}}"}`,
      },
      {
        input: `{"name": "{{  name  }}"}`,
        variables: { name: "John" },
        expected: `{"name": "John"}`,
      },
      // Dot notation tests
      {
        input: "{{user.name}}",
        variables: { user: { name: "Alice" } },
        expected: "Alice",
      },
      {
        input: "Hello {{user.firstName}} {{user.lastName}}!",
        variables: { user: { firstName: "John", lastName: "Doe" } },
        expected: "Hello John Doe!",
      },
      {
        input: "{{a.b.c.d}}",
        variables: { a: { b: { c: { d: "deep" } } } },
        expected: "deep",
      },
      // Array indexing tests
      {
        input: "{{items[0]}}",
        variables: { items: ["first", "second", "third"] },
        expected: "first",
      },
      {
        input: "{{items[2]}}",
        variables: { items: ["a", "b", "c"] },
        expected: "c",
      },
      // Combined dot notation and array indexing
      {
        input: "{{messages[0].content}}",
        variables: { messages: [{ role: "user", content: "Hello" }] },
        expected: "Hello",
      },
      {
        input: "{{input.messages[0].content}}",
        variables: {
          input: {
            messages: [{ role: "user", content: "Show database schema" }],
          },
        },
        expected: "Show database schema",
      },
      {
        input:
          "User: {{input.messages[0].content}}\nExpected: {{reference.answer}}",
        variables: {
          input: { messages: [{ role: "user", content: "Hello" }] },
          reference: { answer: "Hi there!" },
        },
        expected: "User: Hello\nExpected: Hi there!",
      },
      {
        input: "{{data[0][1]}}",
        variables: {
          data: [
            ["a", "b", "c"],
            ["d", "e", "f"],
          ],
        },
        expected: "b",
      },
      // Missing nested path leaves template as-is
      {
        input: "{{user.email}}",
        variables: { user: { name: "Alice" } },
        expected: "{{user.email}}",
      },
    ] as const;
    tests.forEach(({ input, variables, expected }) => {
      expect(formatMustacheLike({ text: input, variables })).toEqual(expected);
    });
  });

  it("should format a f-string template", () => {
    const tests = [
      {
        input: "{name}",
        variables: { name: "John" },
        expected: "John",
      },
      {
        input: "{name} {age}",
        variables: { name: "John", age: 30 },
        expected: "John 30",
      },
      {
        input: "{name} {{age}}",
        variables: { name: "John", age: 30 },
        expected: "John {age}",
      },
      {
        input: `
hi there {name}
how are you?

can you help with this json?

{{ "name": "John", "age": {age} }}`,
        variables: { name: "John", age: 30 },
        expected: `
hi there John
how are you?

can you help with this json?

{ "name": "John", "age": 30 }`,
      },
      {
        input: "\\{test\\}",
        variables: { test: "value" },
        expected: "{test\\}",
      },
    ] as const;
    tests.forEach(({ input, variables, expected }) => {
      expect(formatFString({ text: input, variables })).toEqual(expected);
    });
  });
});
