import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { TemplateFormat } from "@phoenix/components/templateEditor/types";

import {
  type DecisionQuestionTemplate,
  type DecisionStateTemplate,
  getDecisionVariables,
  getWholeTagPath,
  renderDecision,
  renderTextTemplate,
  toPythonJsonText,
} from "../decisionTemplateRendering";

/** The repo root, from js/app/src/components/decision/__tests__. */
const REPO_ROOT = resolve(__dirname, "../../../../../..");

type RenderingCase = {
  name: string;
  template_format: TemplateFormat;
  state: DecisionStateTemplate;
  questions: DecisionQuestionTemplate[];
  variables: Record<string, unknown>;
  derived_variables?: string[];
  expected?: { state: unknown; questions: unknown[] };
  error?: string;
};

const { cases } = JSON.parse(
  readFileSync(
    resolve(REPO_ROOT, "tests/fixtures/decisions/rendering_cases.json"),
    "utf-8"
  )
) as { cases: RenderingCase[] };

describe("the shared decision rendering vectors", () => {
  it("has cases to run", () => {
    expect(cases.length).toBeGreaterThan(30);
  });

  it.each(cases.map((testCase) => [testCase.name, testCase] as const))(
    "%s",
    (_name, testCase) => {
      const definition = {
        templateFormat: testCase.template_format,
        state: testCase.state,
        questions: testCase.questions,
      };
      if (testCase.derived_variables) {
        expect(getDecisionVariables(definition)).toEqual(
          testCase.derived_variables
        );
      }
      const render = () =>
        renderDecision({ ...definition, variables: testCase.variables });
      if (testCase.error != null) {
        expect(render).toThrow(testCase.error);
        return;
      }
      const rendered = render();
      expect(rendered.state).toEqual(testCase.expected?.state);
      expect(rendered.questions).toEqual(testCase.expected?.questions);
      // Key order is part of what is sent.
      expect(JSON.stringify(rendered.state)).toBe(
        JSON.stringify(testCase.expected?.state)
      );
    }
  );
});

describe("toPythonJsonText", () => {
  it("writes JSON as json.dumps(ensure_ascii=False) does", () => {
    expect(
      toPythonJsonText({ a: [1, 2.5, null, true], é: 'Zoë "q"\n', e: {} })
    ).toBe('{"a": [1, 2.5, null, true], "é": "Zoë \\"q\\"\\n", "e": {}}');
  });

  it("writes small floats in Python's exponent form", () => {
    expect(toPythonJsonText(0.00001)).toBe("1e-05");
    expect(toPythonJsonText(1.5e-7)).toBe("1.5e-07");
    expect(toPythonJsonText(0.5)).toBe("0.5");
  });

  it("keeps an own __proto__ key", () => {
    expect(toPythonJsonText(JSON.parse('{"__proto__": {"x": 1}}'))).toBe(
      '{"__proto__": {"x": 1}}'
    );
  });
});

describe("renderTextTemplate under F-String", () => {
  const render = (template: string, variables: Record<string, unknown>) =>
    renderTextTemplate({ templateFormat: "F_STRING", template, variables });

  it("applies format specs and conversions as str.format does", () => {
    expect(
      render("{n:>5}|{n:05d}|{f:.2f}|{p:.0%}", { n: 42, f: 3.14159, p: 0.25 })
    ).toBe("   42|00042|3.14|25%");
    expect(render("{s!r} {s:*^7}", { s: "hi" })).toBe("'hi' **hi***");
    expect(render("{n:,}", { n: 1234567 })).toBe("1,234,567");
  });

  it("reads negative list indexes and reports a missing item", () => {
    expect(render("{items[-1]}", { items: ["a", "b"] })).toBe("b");
    expect(() => render("{items[5]}", { items: ["a"] })).toThrow(
      "Can't render the template: no item 5"
    );
  });
});

describe("renderTextTemplate under Mustache", () => {
  it("reads names in a section from the section's value first", () => {
    expect(
      renderTextTemplate({
        templateFormat: "MUSTACHE",
        template: "{{#customer}}{{name}} ({{tier}}){{/customer}}",
        variables: { customer: { name: "Ana" }, tier: "gold" },
      })
    ).toBe("Ana (gold)");
  });

  it("treats an empty object as false in a section, as pystache does", () => {
    expect(
      renderTextTemplate({
        templateFormat: "MUSTACHE",
        template: "{{#o}}yes{{/o}}{{^o}}no{{/o}}",
        variables: { o: {} },
      })
    ).toBe("no");
  });
});

describe("getWholeTagPath", () => {
  it("finds a typed hole only when the string is exactly one tag", () => {
    expect(
      getWholeTagPath({ templateFormat: "MUSTACHE", text: "{{ a.b }}" })
    ).toBe("a.b");
    expect(
      getWholeTagPath({ templateFormat: "MUSTACHE", text: "x {{a}}" })
    ).toBeNull();
    expect(
      getWholeTagPath({ templateFormat: "MUSTACHE", text: "{{{a}}}" })
    ).toBeNull();
    expect(
      getWholeTagPath({ templateFormat: "F_STRING", text: "{a[0]}" })
    ).toBe("a[0]");
    expect(
      getWholeTagPath({ templateFormat: "F_STRING", text: "{{a}}" })
    ).toBeNull();
    expect(
      getWholeTagPath({ templateFormat: "NONE", text: "{{a}}" })
    ).toBeNull();
  });
});
