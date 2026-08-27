import { CompletionContext } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
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

  // A record name is reached by its whole path, so drilling one has to read
  // the home back in and rewrite the expression the author started.
  it("opens the record's level from a name written without its home", () => {
    const result = completeAt(
      "def evaluate(metadata):\n    value = span.",
      false
    );

    expect(result?.from).toBe(36);
    expect(result?.options.map((o) => o.label)).toEqual([
      "metadata.span.attributes",
      "metadata.span.output_value",
    ]);
    expect(result?.options[1]).toMatchObject({
      info: 'inserts metadata["span"]["output_value"]',
      section: { name: "metadata.span" },
    });
  });

  // The rewritten expression is rooted at a parameter, so an undeclared one
  // leaves nothing that could be written.
  it("offers nothing from a record name whose slot is not declared", () => {
    expect(
      completeAt("def evaluate(input):\n    value = span.", false)
    ).toBeNull();
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

describe("code evaluator signature completions", () => {
  const evaluationContext = materializeEvaluatorContext({
    grain: "span",
    evaluatorMappingSource: {
      grain: "span",
      source: {
        input: "Why?",
        output: "Because.",
        metadata: { latency_ms: 842.5 },
      },
    },
    inputMapping: { pathMapping: {}, literalMapping: {} },
    slotDefaults: getEvaluatorSlotDefaults("span"),
  });
  const spanMappingSource = { input: "Why?", output: "Because.", metadata: {} };
  const datasetMappingSource = {
    input: { question: "capital?" },
    output: { answer: "Paris" },
    reference: { answer: "Paris" },
    metadata: { isGolden: true },
  };

  /**
   * The document a row writes, so a cell is read as the signature the author
   * would be left with rather than as an offset and an insertion.
   */
  function acceptAt({
    language,
    source,
    label,
  }: {
    language: "PYTHON" | "TYPESCRIPT";
    /** The source, with `|` marking the cursor. */
    source: string;
    label: string;
  }): string | null {
    const pos = source.indexOf("|");
    const doc = source.replace("|", "");
    const state = EditorState.create({
      doc,
      extensions: [
        language === "PYTHON" ? python() : javascript({ typescript: true }),
      ],
    });
    const result = createEvaluatorCompletions({
      mappingSource: spanMappingSource,
      language,
      evaluationContext,
    })(new CompletionContext(state, pos, true));
    if (result === null) {
      return null;
    }
    const option = result.options.find((o) => o.label === label);
    if (option === undefined || typeof option.apply !== "string") {
      return null;
    }
    return (
      doc.slice(0, result.from) + option.apply + doc.slice(result.to ?? pos)
    );
  }

  // A row replaces the name the cursor is in, so a name corrected from the
  // middle is rewritten rather than doubled.
  it("rewrites the parameter name the cursor sits inside", () => {
    expect(
      acceptAt({
        language: "PYTHON",
        source: "def evaluate(met|adata, output):\n    return 1\n",
        label: "metadata",
      })
    ).toBe("def evaluate(metadata, output):\n    return 1\n");
    expect(
      acceptAt({
        language: "TYPESCRIPT",
        source: "function evaluate({ inp|ut }) {\n  return 1;\n}\n",
        label: "input",
      })
    ).toBe("function evaluate({ input }) {\n  return 1;\n}\n");
  });

  // Both languages put a space after a separator and inside a destructure, so
  // a row landing against one supplies the space the author has not typed.
  it("spaces a name off the separator it lands against", () => {
    expect(
      acceptAt({
        language: "PYTHON",
        source: "def evaluate(input,|):\n    return 1\n",
        label: "output",
      })
    ).toBe("def evaluate(input, output):\n    return 1\n");
    expect(
      acceptAt({
        language: "TYPESCRIPT",
        source: "function evaluate({|}) {\n  return 1;\n}\n",
        label: "input",
      })
    ).toBe("function evaluate({ input }) {\n  return 1;\n}\n");
  });

  // A TypeScript evaluator is handed one object, so a parameter list that has
  // not opened a destructure grows one around the name.
  it("opens a destructure around a name written as a bare parameter", () => {
    expect(
      acceptAt({
        language: "TYPESCRIPT",
        source: "function evaluate(in|) {\n  return 1;\n}\n",
        label: "input",
      })
    ).toBe("function evaluate({ input }) {\n  return 1;\n}\n");
    expect(
      acceptAt({
        language: "TYPESCRIPT",
        source: "const evaluate = (|) => {\n  return 1;\n};\n",
        label: "metadata",
      })
    ).toBe("const evaluate = ({ metadata }) => {\n  return 1;\n};\n");
  });

  // Only a name binds one of the evaluator's inputs; everything else in the
  // declaration would take the row as ordinary text.
  it.each([
    ["a default value", "def evaluate(input, latency=out|):\n    return 1\n"],
    ["an annotation", "def evaluate(input: met|):\n    return 1\n"],
    ["a variadic", "def evaluate(input, **met|):\n    return 1\n"],
  ])("offers nothing inside %s", (_name, source) => {
    const pos = source.indexOf("|");
    const state = EditorState.create({
      doc: source.replace("|", ""),
      extensions: [python()],
    });
    expect(
      createEvaluatorCompletions({
        mappingSource: spanMappingSource,
        language: "PYTHON",
        evaluationContext,
      })(new CompletionContext(state, pos, true))
    ).toBeNull();
  });

  // A dataset evaluator authors against the mapping source alone, where the
  // language helpers are body snippets rather than names a parameter can be.
  it("offers a dataset evaluator only the names it is handed", () => {
    const source = "function evaluate({|}) {\n  return 1;\n}\n";
    const pos = source.indexOf("|");
    const state = EditorState.create({
      doc: source.replace("|", ""),
      extensions: [javascript({ typescript: true })],
    });
    const result = createEvaluatorCompletions({
      mappingSource: datasetMappingSource,
      language: "TYPESCRIPT",
      evaluationContext: null,
    })(new CompletionContext(state, pos, true));

    expect(result?.options.map((o) => o.label)).toEqual([
      "output",
      "reference",
      "input",
      "metadata",
    ]);
  });
});
