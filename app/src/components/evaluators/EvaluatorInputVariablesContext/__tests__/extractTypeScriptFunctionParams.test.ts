import { extractTypeScriptFunctionParams } from "../extractTypeScriptFunctionParams";

describe("extractTypeScriptFunctionParams", () => {
  it("extracts destructured params with type annotations", () => {
    const code = `function evaluate({ output, input }: { output: string; input: string }): number {
      return 0.0;
    }`;
    expect(extractTypeScriptFunctionParams(code)).toEqual([
      { name: "output", type: "string" },
      { name: "input", type: "string" },
    ]);
  });

  it("extracts destructured params without type annotations", () => {
    const code = `function evaluate({ output, input }) {
      return 0.0;
    }`;
    expect(extractTypeScriptFunctionParams(code)).toEqual([
      { name: "output", type: undefined },
      { name: "input", type: undefined },
    ]);
  });

  it("extracts params from arrow function syntax", () => {
    const code = `const evaluate = ({ output, input }: { output: string; input: number }) => {
      return { score: 0.9 };
    }`;
    expect(extractTypeScriptFunctionParams(code)).toEqual([
      { name: "output", type: "string" },
      { name: "input", type: "number" },
    ]);
  });

  it("extracts params from single object parameter", () => {
    const code = `function evaluate(inputs: { output: string; input: string }): number {
      return 0.0;
    }`;
    expect(extractTypeScriptFunctionParams(code)).toEqual([
      { name: "output", type: "string" },
      { name: "input", type: "string" },
    ]);
  });

  it("handles boolean types", () => {
    const code = `function evaluate({ text, caseSensitive }: { text: string; caseSensitive: boolean }) {
      return text;
    }`;
    expect(extractTypeScriptFunctionParams(code)).toEqual([
      { name: "text", type: "string" },
      { name: "caseSensitive", type: "boolean" },
    ]);
  });

  it("handles array types", () => {
    const code = `function evaluate({ items }: { items: string[] }) {
      return items.length;
    }`;
    expect(extractTypeScriptFunctionParams(code)).toEqual([
      { name: "items", type: "array" },
    ]);
  });

  it("handles optional properties", () => {
    const code = `function evaluate({ output, input }: { output: string; input?: string }) {
      return output;
    }`;
    expect(extractTypeScriptFunctionParams(code)).toEqual([
      { name: "output", type: "string" },
      { name: "input", type: "string" },
    ]);
  });

  it("handles multiline type definitions", () => {
    const code = `function evaluate({
      output,
      input,
    }: {
      output: string;
      input: string;
    }): { score: number } {
      return { score: 0.9 };
    }`;
    expect(extractTypeScriptFunctionParams(code)).toEqual([
      { name: "output", type: "string" },
      { name: "input", type: "string" },
    ]);
  });

  it("returns empty array for non-matching code", () => {
    const code = `const x = 5;`;
    expect(extractTypeScriptFunctionParams(code)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(extractTypeScriptFunctionParams("")).toEqual([]);
  });
});
