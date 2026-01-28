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

  it("should extract only top-level variables from mustache sections", () => {
    const tests = [
      { input: "{{#items}}{{name}}{{/items}}", expected: ["items"] },
      {
        input: "{{input}}{{#messages}}{{role}}{{/messages}}",
        expected: ["input", "messages"],
      },
      {
        input: "{{#outer}}{{#inner}}{{x}}{{/inner}}{{/outer}}",
        expected: ["outer"],
      },
      { input: "{{^items}}No items{{/items}}", expected: ["items"] },
      {
        input: "{{#items}}{{name}}{{/items}}{{^items}}Empty{{/items}}",
        expected: ["items"],
      },
      {
        input: `{{#messages}}
{{role}}: {{content}}
{{#tool_calls}}
- {{function.name}}({{function.arguments}})
{{/tool_calls}}
{{/messages}}`,
        expected: ["messages"],
      },
      { input: "{{#a}}{{x}}{{/a}}{{#b}}{{y}}{{/b}}", expected: ["a", "b"] },
      {
        input: "{{simple}}{{#list}}{{item}}{{/list}}",
        expected: ["simple", "list"],
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
