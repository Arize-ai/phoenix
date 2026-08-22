import { describe, expect, it } from "vitest";

import {
  getCodeEvaluatorMemberCursor,
  toCodeEvaluatorAccessor,
} from "../codeEvaluatorMemberPath";

describe("getCodeEvaluatorMemberCursor", () => {
  it("reads either language's member syntax as one canonical path", () => {
    expect(getCodeEvaluatorMemberCursor('    convo = input["')).toMatchObject({
      containerPath: "input",
      partial: "",
      from: 19,
      accessorFrom: 17,
    });
    expect(
      getCodeEvaluatorMemberCursor('  const x = input["attributes"]["llm"][')
    ).toMatchObject({
      containerPath: "input.attributes.llm",
      partial: "",
      accessorFrom: 38,
    });
    expect(
      getCodeEvaluatorMemberCursor("  const x = input.attributes?.llm.mod")
    ).toMatchObject({
      containerPath: "input.attributes.llm",
      partial: "mod",
      accessorFrom: 33,
    });
    // A key with a dot of its own is one key, not two levels.
    expect(
      getCodeEvaluatorMemberCursor('input["attributes"]["invocation.params"].')
    ).toMatchObject({
      containerPath: "input.attributes['invocation.params']",
      partial: "",
    });
    // A bare name is the body's root completion, not a drill.
    expect(getCodeEvaluatorMemberCursor("    return inp")).toBeNull();
  });
});

describe("toCodeEvaluatorAccessor", () => {
  it("writes the accessor in the editor's own language", () => {
    const key = { key: "attributes", isIndex: false, isAbsent: false };

    expect(toCodeEvaluatorAccessor({ language: "PYTHON", ...key })).toBe(
      '["attributes"]'
    );
    expect(toCodeEvaluatorAccessor({ language: "TYPESCRIPT", ...key })).toBe(
      ".attributes"
    );
    expect(
      toCodeEvaluatorAccessor({
        language: "TYPESCRIPT",
        ...key,
        isAbsent: true,
      })
    ).toBe("?.attributes");
    // A key that is not an identifier is bracketed in both languages.
    expect(
      toCodeEvaluatorAccessor({
        language: "TYPESCRIPT",
        key: "invocation.params",
        isIndex: false,
        isAbsent: false,
      })
    ).toBe('["invocation.params"]');
    expect(
      toCodeEvaluatorAccessor({
        language: "PYTHON",
        key: "0",
        isIndex: true,
        isAbsent: false,
      })
    ).toBe("[0]");
  });
});
