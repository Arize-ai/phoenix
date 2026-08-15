import { describe, expect, it } from "vitest";

import { createCompletionOptions } from "../codeEvaluatorAutocomplete";

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
