import { scopeExampleVariables } from "../datasetExampleVariables";
import {
  formatInputPreview,
  getDecisionInputPreviews,
  getExampleInputNames,
} from "../decisionStateInputsHints";
import { toStructuredInputValue } from "../decisionUtils";

describe("formatInputPreview", () => {
  it("prints a value as one line of JSON", () => {
    expect(formatInputPreview({ value: "Paris" })).toEqual({
      text: '"Paris"',
      full: "Paris",
    });
    expect(formatInputPreview({ value: { capital: "Paris" } })).toEqual({
      text: '{"capital":"Paris"}',
      full: '{\n  "capital": "Paris"\n}',
    });
    expect(formatInputPreview({ value: 2 }).text).toBe("2");
    expect(formatInputPreview({ value: null }).text).toBe("null");
  });

  it("collapses line breaks and runs of whitespace", () => {
    expect(
      formatInputPreview({ value: "first line\n\n  second\tline" }).text
    ).toBe('"first line second line"');
  });

  it("cuts long values with an ellipsis", () => {
    const { text, full } = formatInputPreview({
      value: "a".repeat(100),
      maxChars: 20,
    });
    expect(text).toHaveLength(20);
    expect(text.endsWith("…")).toBe(true);
    expect(full).toBe("a".repeat(100));
  });
});

describe("scopeExampleVariables", () => {
  const example = {
    input: { question: "q" },
    output: { answer: "a" },
    metadata: { source: "s" },
  };

  it("reads under the template variables path", () => {
    expect(
      scopeExampleVariables({ example, templateVariablesPath: "input" })
    ).toEqual({
      question: "q",
    });
    expect(
      scopeExampleVariables({ example, templateVariablesPath: "reference" })
    ).toEqual({
      answer: "a",
    });
  });

  it("is the whole example context without a path", () => {
    expect(
      scopeExampleVariables({ example, templateVariablesPath: null })
    ).toEqual({
      input: { question: "q" },
      reference: { answer: "a" },
      metadata: { source: "s" },
    });
    expect(
      scopeExampleVariables({ example, templateVariablesPath: "" })
    ).toEqual(scopeExampleVariables({ example, templateVariablesPath: null }));
  });
});

describe("getExampleInputNames", () => {
  it("dedupes top-level keys across examples in first-seen order", () => {
    expect(
      getExampleInputNames([
        { b: 1, a: { nested: true } },
        { a: 2, c: 3 },
        "not an object",
        undefined,
        [1, 2],
      ])
    ).toEqual(["b", "a", "c"]);
  });

  it("follows a path root", () => {
    const examples = [
      { input: { ticket: "t" }, output: { label: "l" }, metadata: {} },
      { input: { ticket: "u", customer: "c" }, output: {}, metadata: {} },
    ];
    expect(
      getExampleInputNames(
        examples.map((example) =>
          scopeExampleVariables({ example, templateVariablesPath: "input" })
        )
      )
    ).toEqual(["ticket", "customer"]);
    expect(
      getExampleInputNames(
        examples.map((example) =>
          scopeExampleVariables({ example, templateVariablesPath: null })
        )
      )
    ).toEqual(["input", "reference", "metadata"]);
  });
});

describe("getDecisionInputPreviews", () => {
  it("shows typed values as they are sent and skips empty ones", () => {
    expect(
      getDecisionInputPreviews({
        names: ["reference", "output", "blank"],
        exampleVariables: undefined,
        variables: { reference: '{"capital": "Paris"}', output: "Paris" },
        toSentValue: toStructuredInputValue,
      })
    ).toEqual({
      reference: {
        kind: "value",
        text: '{"capital":"Paris"}',
        full: '{\n  "capital": "Paris"\n}',
      },
      output: { kind: "value", text: '"Paris"', full: "Paris" },
    });
  });

  it("shows the first example's values over a dataset", () => {
    expect(
      getDecisionInputPreviews({
        names: ["ticket", "missing"],
        exampleVariables: [{ ticket: "Refund please" }, { ticket: "later" }],
        variables: { ticket: "typed values are ignored" },
        toSentValue: toStructuredInputValue,
      })
    ).toEqual({
      ticket: {
        kind: "value",
        source: "example 1",
        text: '"Refund please"',
        full: "Refund please",
      },
      missing: { kind: "missing", source: "example 1" },
    });
  });

  it("shows nothing while a dataset's examples load", () => {
    expect(
      getDecisionInputPreviews({
        names: ["ticket"],
        exampleVariables: [],
        variables: { ticket: "typed" },
        toSentValue: toStructuredInputValue,
      })
    ).toEqual({});
  });
});
