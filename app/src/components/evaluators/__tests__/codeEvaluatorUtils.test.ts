import { describe, expect, it } from "vitest";

import type { ClassificationEvaluatorAnnotationConfig } from "@phoenix/types";

import { getDefaultCodeEvaluatorSource } from "../codeEvaluatorUtils";

function _catConfig(label: string): ClassificationEvaluatorAnnotationConfig {
  return {
    type: "CATEGORICAL",
    name: "score",
    optimizationDirection: "MAXIMIZE",
    description: "",
    values: [{ label, score: 1 }],
  } as unknown as ClassificationEvaluatorAnnotationConfig;
}

describe("getDefaultCodeEvaluatorSource — label escaping", () => {
  it("escapes embedded double-quotes in Python output", () => {
    const source = getDefaultCodeEvaluatorSource(
      "PYTHON",
      "categorical",
      _catConfig('say "hi"')
    );
    // The escaped form must appear; the raw unescaped form must not.
    expect(source).toContain('"say \\"hi\\""');
    expect(source).not.toMatch(/return "say "hi""/);
  });

  it("escapes embedded double-quotes in TypeScript output", () => {
    const source = getDefaultCodeEvaluatorSource(
      "TYPESCRIPT",
      "categorical",
      _catConfig('say "hi"')
    );
    expect(source).toContain('"say \\"hi\\""');
    expect(source).not.toMatch(/return "say "hi"";/);
  });

  it("escapes backslashes so they don't form unintended escape sequences", () => {
    const source = getDefaultCodeEvaluatorSource(
      "PYTHON",
      "categorical",
      _catConfig("a\\b")
    );
    // JSON.stringify renders \ as \\ (two characters), so the source contains
    // four characters: \ \ \ \  (each \\ represents a single backslash in
    // the source string).
    expect(source).toContain('"a\\\\b"');
  });

  it("escapes newlines so the literal stays on one line", () => {
    const source = getDefaultCodeEvaluatorSource(
      "PYTHON",
      "categorical",
      _catConfig("line1\nline2")
    );
    // Newline must be escaped to \n inside the literal — not pass through raw
    // and split the return statement across two physical lines.
    expect(source).toContain('"line1\\nline2"');
    // The bare-return line should be one line, not two.
    const returnLines = source
      .split("\n")
      .filter((line) => line.includes("return "));
    for (const line of returnLines) {
      expect(line).toContain("line1\\nline2");
    }
  });
});
