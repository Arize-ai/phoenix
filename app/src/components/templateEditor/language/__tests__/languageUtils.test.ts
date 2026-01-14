import { formatFString, FStringTemplatingLanguage } from "../fString";
import {
  extractVariablesFromJSONPath,
  formatJSONPath,
  JSONPathTemplatingLanguage,
} from "../jsonPath";
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

  it("should extract variable names from a JSON_PATH template", () => {
    const tests = [
      { input: "{$.name}", expected: ["$.name"] },
      { input: "{$.name} {$.age}", expected: ["$.name", "$.age"] },
      {
        input:
          "Hi I'm {$.name} and I'm {$.age} years old and I live in {$.city}",
        expected: ["$.name", "$.age", "$.city"],
      },
      {
        input: `Hi {$.name}, you are {$.age} years old`,
        expected: ["$.name", "$.age"],
      },
      {
        input: `Name: {$.name} Age: \\{$.age}`,
        expected: ["$.name"],
      },
      {
        input: `Value: {  $.name  }`,
        expected: ["$.name"],
      },
      { input: "{$.nested.path}", expected: ["$.nested.path"] },
      { input: "{$.array[0]}", expected: ["$.array[0]"] },
      { input: "{$.deep[0].nested}", expected: ["$.deep[0].nested"] },
      { input: "\\{$.notavar}", expected: [] },
    ] as const;
    tests.forEach(({ input, expected }) => {
      expect(extractVariablesFromJSONPath(input)).toEqual(expected);
    });
  });

  it("should format a JSON_PATH template", () => {
    const tests = [
      {
        input: "{$.name}",
        variables: { "$.name": "John" },
        expected: "John",
      },
      {
        input: "{$.name} {$.age}",
        variables: { "$.name": "John", "$.age": 30 },
        expected: "John 30",
      },
      {
        input: "{$.name} {$.city}",
        variables: { "$.name": "John" },
        expected: "John {$.city}",
      },
      {
        input: `Hi {$.name}, you are {$.age} years old`,
        variables: { "$.name": "John", "$.age": 30 },
        expected: `Hi John, you are 30 years old`,
      },
      {
        input: `Name: \\{$.name} Age: {$.age}`,
        variables: { "$.name": "John", "$.age": 30 },
        expected: `Name: {$.name} Age: 30`,
      },
      {
        input: `Value: {  $.name  }`,
        variables: { "$.name": "John" },
        expected: `Value: John`,
      },
      {
        input: "{$.nested.path}",
        variables: { "$.nested.path": "value" },
        expected: "value",
      },
      {
        input: "{$.array[0]}",
        variables: { "$.array[0]": "first" },
        expected: "first",
      },
      {
        input: "{$.deep[0].nested}",
        variables: { "$.deep[0].nested": "deep value" },
        expected: "deep value",
      },
    ] as const;
    tests.forEach(({ input, variables, expected }) => {
      expect(formatJSONPath({ text: input, variables })).toEqual(expected);
    });
  });
});
