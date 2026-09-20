import { getInitialEvaluatorInputMode } from "../initialInputMode";

describe("getInitialEvaluatorInputMode", () => {
  it("restores literal mode when a literal value survived", () => {
    expect(getInitialEvaluatorInputMode({ somevar: "foo" }, "somevar")).toBe(
      "literal"
    );
  });

  it("preserves falsy literal values", () => {
    expect(getInitialEvaluatorInputMode({ flag: false }, "flag")).toBe(
      "literal"
    );
    expect(getInitialEvaluatorInputMode({ count: 0 }, "count")).toBe("literal");
  });

  it("defaults to path mode when no literal value exists", () => {
    expect(getInitialEvaluatorInputMode({}, "somevar")).toBe("path");
  });
});
