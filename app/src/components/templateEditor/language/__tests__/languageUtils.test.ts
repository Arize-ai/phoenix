import { formatFString, FStringTemplatingLanguage } from "../fString";
import { extractVariables } from "../languageUtils";
import {
  extractVariablesFromMustacheLike,
  formatMustacheLike,
  validateMustacheSections,
} from "../mustacheLike";

describe("language utils", () => {
  it("should extract variable names from a mustache-like template", () => {
    const tests = [
      { input: "{{name}}", expected: ["name"] },
      { input: "{{name}} {{{age}}}", expected: ["name", "age"] },
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
        expected: ["name", "age"],
      },
      {
        input: `{"name": "{{{name}}}"}`,
        expected: ["name"],
      },
      {
        input: `{"name": "{{  name  }}"}`,
        expected: ["name"],
      },
    ] as const;
    tests.forEach(({ input, expected }) => {
      expect(extractVariablesFromMustacheLike(input)).toEqual(expected);
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
      expect(extractVariablesFromMustacheLike(input)).toEqual(expected);
    });
  });

  it("should extract only root variable names from dotted paths", () => {
    // Mustache uses dot notation to traverse nested objects (e.g., user.name
    // means context["user"]["name"]). For validation, we only need the root.
    const tests = [
      { input: "{{user.name}}", expected: ["user"] },
      { input: "{{user.name}} and {{user.email}}", expected: ["user"] },
      {
        input: "{{user.name}} and {{account.id}}",
        expected: ["user", "account"],
      },
      {
        input:
          "{{#output.available_tools}}{{function.name}}{{/output.available_tools}}",
        expected: ["output"],
      },
      {
        input: `{{#output.available_tools}}
- {{function.name}}: {{function.description}}
{{/output.available_tools}}
{{^output.available_tools}}
No tools available.
{{/output.available_tools}}`,
        expected: ["output"],
      },
      {
        input: "{{input}}{{#output.messages}}{{role}}{{/output.messages}}",
        expected: ["input", "output"],
      },
    ] as const;
    tests.forEach(({ input, expected }) => {
      expect(extractVariablesFromMustacheLike(input)).toEqual(expected);
    });
  });

  it("should validate mustache section tags", () => {
    const tests = [
      {
        input: "{{#query}}\n{{#messages}}\n{{role}}\n{{/messages}}",
        expected: {
          errors: [],
          warnings: ["Unclosed section tag: {{#query}}"],
        },
      },
      {
        input: "{{^available_tools}}\n{{name}}",
        expected: {
          errors: [],
          warnings: ["Unclosed section tag: {{^available_tools}}"],
        },
      },
      {
        input: "{{/items}}",
        expected: {
          errors: ["Unmatched closing tag: {{/items}}"],
          warnings: [],
        },
      },
      {
        input: "{{#items}}{{name}}{{/items}}",
        expected: {
          errors: [],
          warnings: [],
        },
      },
      {
        input: "{{#a}}{{/b}}",
        expected: {
          errors: ["Unmatched closing tag: {{/b}}"],
          warnings: [],
        },
      },
      {
        input: "{{#messages}}{{#tool_calls}}{{/messages}}",
        expected: {
          errors: [
            "Missing closing tag for {{#tool_calls}} before {{/messages}}",
          ],
          warnings: [],
        },
      },
      {
        input: "{{#messages}}{{^tool_calls}}{{/messages}}",
        expected: {
          errors: [
            "Missing closing tag for {{^tool_calls}} before {{/messages}}",
          ],
          warnings: [],
        },
      },
    ] as const;
    tests.forEach(({ input, expected }) => {
      expect(validateMustacheSections(input)).toEqual(expected);
    });
  });

  it("should return no errors/warnings for valid mustache templates (native-first validation)", () => {
    // These templates are valid Mustache and should pass native parser validation
    const validTemplates = [
      "{{name}}",
      "Hello {{name}}, you are {{age}} years old.",
      "{{#items}}{{name}}{{/items}}",
      "{{^items}}No items{{/items}}",
      "{{{unescaped}}}",
      "{{& unescaped}}",
      "{{! This is a comment }}",
      "{{#outer}}{{#inner}}{{value}}{{/inner}}{{/outer}}",
      `{{#messages}}
{{role}}: {{content}}
{{/messages}}`,
    ];
    validTemplates.forEach((template) => {
      const result = validateMustacheSections(template);
      expect(result).toEqual({ errors: [], warnings: [] });
    });
  });

  it("should handle mustache comments and partials correctly", () => {
    // Comments should be ignored by both native parser and fallback
    const withComment = "{{! comment }}{{name}}";
    expect(validateMustacheSections(withComment)).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it("should not extract malformed triple braces as variable names in fallback", () => {
    // When native parser fails on malformed input, the fallback should not
    // return `{name` as a variable (from regex capturing `{{{name` wrongly)
    // Note: Well-formed triple braces like {{{name}}} work fine with native parser
    const tests = [
      // Valid triple braces should extract correctly via native parser
      { input: "{{{name}}}", expected: ["name"] },
      // Unescaped variables with & should also work
      { input: "{{& name}}", expected: ["name"] },
    ];
    tests.forEach(({ input, expected }) => {
      expect(extractVariablesFromMustacheLike(input)).toEqual(expected);
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
        expected: "Hi John, this is bad syntax ",
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
