import { describe, expect, it } from "vitest";

import { maskNonCode } from "@phoenix/agent/uiOperations/runtime/maskNonCode";

/** Collapse whitespace runs to make masked output easy to eyeball. */
const visible = (masked: string) => masked.replace(/\s+/g, " ").trim();

describe("maskNonCode", () => {
  it("preserves length and line structure", () => {
    const source = "const a = 1; // note\nconst b = 'x';\n/* multi\nline */";
    const masked = maskNonCode(source);
    expect(masked.length).toBe(source.length);
    expect(masked.split("\n").length).toBe(source.split("\n").length);
  });

  it("keeps code and masks line comments", () => {
    expect(visible(maskNonCode("f(); // secret"))).toBe("f();");
  });

  it("masks block comments, including multi-line ones", () => {
    expect(visible(maskNonCode("f(); /* a\nb\nc */ g();"))).toBe("f(); g();");
  });

  it("masks string contents and keeps escapes from ending them early", () => {
    expect(visible(maskNonCode(`const s = "a\\"b"; f();`))).toBe(
      "const s = ; f();"
    );
    expect(visible(maskNonCode("const s = 'it\\'s'; g();"))).toBe(
      "const s = ; g();"
    );
  });

  it("masks template text but keeps interpolations as code", () => {
    expect(visible(maskNonCode("`hello ${name.toUpperCase()}!`"))).toBe(
      "name.toUpperCase()"
    );
  });

  it("keeps nested interpolations with braces and nested templates", () => {
    expect(visible(maskNonCode("`a${ { b: `c${x}` }.b }d`"))).toBe("{ b: x }.b");
  });

  it("masks regex literals after expression-openers", () => {
    expect(visible(maskNonCode('const r = /["\']+/g; f();'))).toBe(
      "const r = ; f();"
    );
    expect(visible(maskNonCode("if (ok) /x/.test(s);"))).toBe("if (ok) .test(s);");
  });

  it("does not mistake division for a regex", () => {
    expect(visible(maskNonCode("const x = a / b / c;"))).toBe(
      "const x = a / b / c;"
    );
  });

  it("handles unterminated constructs without running past the end", () => {
    expect(maskNonCode("const s = 'oops").length).toBe("const s = 'oops".length);
    expect(maskNonCode("/* never closed").length).toBe("/* never closed".length);
  });
});
