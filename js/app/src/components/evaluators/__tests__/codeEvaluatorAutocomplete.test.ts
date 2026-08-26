import { CompletionContext } from "@codemirror/autocomplete";
import { python } from "@codemirror/lang-python";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import {
  createCompletionOptions,
  createEvaluatorCompletions,
} from "../codeEvaluatorAutocomplete";
import { materializeEvaluatorContext } from "../evaluatorContext";
import { getEvaluatorSlotDefaults } from "../evaluatorSlotDefaults";

describe("createCompletionOptions", () => {
  const mappingSource = {
    output: {
      answer: "Paris",
      nested: {
        score: 1,
      },
      items: [
        {
          name: "alpha",
        },
      ],
    },
    reference: {
      answer: "Paris",
    },
    input: {
      question: "What is the capital of France?",
    },
    metadata: {
      isGolden: true,
    },
  };

  it("produces sensible nested and indexed property completions", () => {
    const options = createCompletionOptions({
      mappingSource,
      language: "TYPESCRIPT",
    });

    const labels = options.map((option) => option.label);

    expect(labels).toContain("output");
    expect(labels).toContain("reference");
    expect(labels).toContain("input");
    expect(labels).toContain("metadata");
    expect(labels).toContain("output.answer");
    expect(labels).toContain("output.nested");
    expect(labels).toContain("output.nested.score");
    expect(labels).toContain("output.items");
    expect(labels).toContain("output.items[0]");
    expect(labels).toContain("output.items[0].name");
  });

  it("includes useful type information for completion entries", () => {
    const options = createCompletionOptions({
      mappingSource,
      language: "TYPESCRIPT",
    });

    expect(
      options.find((option) => option.label === "output.answer")?.info
    ).toBe('string: "Paris"');
    expect(
      options.find((option) => option.label === "output.items")?.info
    ).toBe("array (1 items)");
    expect(
      options.find((option) => option.label === "metadata.isGolden")?.info
    ).toBe("boolean: true");
  });

  it("adds language-specific helper completions", () => {
    const pythonOptions = createCompletionOptions({
      mappingSource,
      language: "PYTHON",
    });
    const typescriptOptions = createCompletionOptions({
      mappingSource,
      language: "TYPESCRIPT",
    });

    expect(pythonOptions.map((option) => option.label)).toContain(".get(");
    expect(pythonOptions.map((option) => option.label)).toContain(
      "isinstance("
    );
    expect(typescriptOptions.map((option) => option.label)).toContain("?.");
    expect(typescriptOptions.map((option) => option.label)).toContain("typeof");
  });
});

describe("code evaluator completions", () => {
  const evaluationContext = materializeEvaluatorContext({
    grain: "span",
    evaluatorMappingSource: {
      grain: "span",
      source: {
        input: "Why?",
        output: "Because.",
        metadata: {
          latency_ms: 842.5,
          span: {
            attributes: { llm: { model_name: "gpt-4o-mini" } },
            output_value: "Because.",
          },
        },
      },
    },
    inputMapping: { pathMapping: {}, literalMapping: {} },
    slotDefaults: getEvaluatorSlotDefaults("span"),
  });
  const spanMappingSource = { input: "Why?", output: "Because.", metadata: {} };

  function completeAt(source: string, explicit = true) {
    const state = EditorState.create({ doc: source, extensions: [python()] });
    return createEvaluatorCompletions({
      mappingSource: spanMappingSource,
      language: "PYTHON",
      evaluationContext,
    })(new CompletionContext(state, source.length, explicit));
  }

  // A parameter is a name, so only the three the evaluator is handed can be
  // one; everything under them is reached in the body.
  it("offers only the evaluator's own inputs in the signature", () => {
    expect(completeAt("def evaluate(")?.options.map((o) => o.label)).toEqual([
      "input",
      "output",
      "metadata",
    ]);
  });

  it("reaches a record name from the body by the name alone", () => {
    const result = completeAt("def evaluate(metadata):\n    value = latency");

    expect(
      result?.options.find((o) => o.label === "metadata.latency_ms")
    ).toMatchObject({
      apply: 'metadata["latency_ms"]',
      info: 'inserts metadata["latency_ms"]',
      detail: "842.5",
    });
  });

  // Nothing under an undeclared parameter can be written, so nothing under it
  // is offered.
  it("offers nothing from a parameter the signature does not declare", () => {
    expect(completeAt("def evaluate(input):\n    value = latency")).toBeNull();
  });

  it("offers the container's members and commits them in the editor's language", () => {
    const result = completeAt(
      "def evaluate(metadata, output):\n    record = metadata[",
      false
    );

    expect(result?.options.map((o) => o.label)).toEqual(["latency_ms", "span"]);
    expect(result?.options[0]).toMatchObject({
      info: 'inserts metadata["latency_ms"]',
      section: { name: "metadata" },
    });
  });
});
