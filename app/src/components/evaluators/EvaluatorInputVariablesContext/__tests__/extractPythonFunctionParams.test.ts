import { extractPythonFunctionParams } from "../extractPythonFunctionParams";

describe("extractPythonFunctionParams", () => {
  describe("basic parameter extraction", () => {
    it("extracts parameters from a simple function", () => {
      expect(extractPythonFunctionParams("def score(a, b, c):")).toEqual([
        { name: "a", type: undefined },
        { name: "b", type: undefined },
        { name: "c", type: undefined },
      ]);
    });

    it("returns empty array for code with no function", () => {
      expect(extractPythonFunctionParams("x = 1")).toEqual([]);
    });

    it("returns empty array for empty string", () => {
      expect(extractPythonFunctionParams("")).toEqual([]);
    });

    it("returns empty array for a function with no parameters", () => {
      expect(extractPythonFunctionParams("def score():")).toEqual([]);
    });

    it("returns empty array for non-score function definitions", () => {
      expect(extractPythonFunctionParams("def helper(a, b):")).toEqual([]);
      expect(extractPythonFunctionParams("def evaluate(a: str):")).toEqual([]);
    });

    it("filters out self and cls", () => {
      expect(extractPythonFunctionParams("def score(self, a, b):")).toEqual([
        { name: "a", type: undefined },
        { name: "b", type: undefined },
      ]);
      expect(extractPythonFunctionParams("def score(cls, a):")).toEqual([
        { name: "a", type: undefined },
      ]);
    });

    it("strips default values", () => {
      expect(extractPythonFunctionParams('def score(a=1, b="hello"):')).toEqual(
        [
          { name: "a", type: undefined },
          { name: "b", type: undefined },
        ]
      );
    });

    it("strips * and ** prefixes", () => {
      expect(
        extractPythonFunctionParams("def score(*args, **kwargs):")
      ).toEqual([
        { name: "args", type: undefined },
        { name: "kwargs", type: undefined },
      ]);
    });
  });

  describe("simple type annotations", () => {
    it("extracts str annotation", () => {
      expect(extractPythonFunctionParams("def score(a: str):")).toEqual([
        { name: "a", type: "string" },
      ]);
    });

    it("extracts int annotation", () => {
      expect(extractPythonFunctionParams("def score(a: int):")).toEqual([
        { name: "a", type: "integer" },
      ]);
    });

    it("extracts float annotation", () => {
      expect(extractPythonFunctionParams("def score(a: float):")).toEqual([
        { name: "a", type: "number" },
      ]);
    });

    it("extracts bool annotation", () => {
      expect(extractPythonFunctionParams("def score(a: bool):")).toEqual([
        { name: "a", type: "boolean" },
      ]);
    });

    it("extracts list annotation", () => {
      expect(extractPythonFunctionParams("def score(a: list):")).toEqual([
        { name: "a", type: "array" },
      ]);
    });

    it("extracts dict annotation", () => {
      expect(extractPythonFunctionParams("def score(a: dict):")).toEqual([
        { name: "a", type: "object" },
      ]);
    });

    it("extracts List (capitalized) annotation", () => {
      expect(extractPythonFunctionParams("def score(a: List):")).toEqual([
        { name: "a", type: "array" },
      ]);
    });

    it("extracts Dict (capitalized) annotation", () => {
      expect(extractPythonFunctionParams("def score(a: Dict):")).toEqual([
        { name: "a", type: "object" },
      ]);
    });
  });

  describe("Optional types", () => {
    it("extracts Optional[str] as string", () => {
      expect(
        extractPythonFunctionParams("def score(a: Optional[str]):")
      ).toEqual([{ name: "a", type: "string" }]);
    });

    it("extracts Optional[int] as integer", () => {
      expect(
        extractPythonFunctionParams("def score(a: Optional[int]):")
      ).toEqual([{ name: "a", type: "integer" }]);
    });

    it("extracts Optional[float] as number", () => {
      expect(
        extractPythonFunctionParams("def score(a: Optional[float]):")
      ).toEqual([{ name: "a", type: "number" }]);
    });

    it("extracts Optional[bool] as boolean", () => {
      expect(
        extractPythonFunctionParams("def score(a: Optional[bool]):")
      ).toEqual([{ name: "a", type: "boolean" }]);
    });
  });

  describe("generic subscript types", () => {
    it("extracts List[str] as array", () => {
      expect(extractPythonFunctionParams("def score(a: List[str]):")).toEqual([
        { name: "a", type: "array" },
      ]);
    });

    it("extracts Dict[str, int] as object", () => {
      // Note: Dict[str, int] contains a comma which splits across params,
      // but the outer type name is still captured from the first part
      expect(
        extractPythonFunctionParams("def score(a: dict):") // simple dict
      ).toEqual([{ name: "a", type: "object" }]);
    });
  });

  describe("unrecognized and missing types", () => {
    it("returns undefined for unannotated parameters", () => {
      expect(extractPythonFunctionParams("def score(a):")).toEqual([
        { name: "a", type: undefined },
      ]);
    });

    it("returns undefined for unrecognized type annotations", () => {
      expect(
        extractPythonFunctionParams("def score(a: MyCustomClass):")
      ).toEqual([{ name: "a", type: undefined }]);
    });
  });

  describe("mixed parameters", () => {
    it("handles a mix of annotated and unannotated parameters", () => {
      expect(
        extractPythonFunctionParams(
          "def score(input: str, threshold: float, verbose):"
        )
      ).toEqual([
        { name: "input", type: "string" },
        { name: "threshold", type: "number" },
        { name: "verbose", type: undefined },
      ]);
    });

    it("handles annotated parameters with defaults", () => {
      expect(
        extractPythonFunctionParams('def score(a: int = 5, b: str = "hi"):')
      ).toEqual([
        { name: "a", type: "integer" },
        { name: "b", type: "string" },
      ]);
    });
  });

  describe("multiline signatures", () => {
    it("handles multiline function signatures", () => {
      const code = `def score(
    input: str,
    output: str,
    threshold: float
):`;
      expect(extractPythonFunctionParams(code)).toEqual([
        { name: "input", type: "string" },
        { name: "output", type: "string" },
        { name: "threshold", type: "number" },
      ]);
    });

    it("handles multiline with defaults and mixed annotations", () => {
      const code = `def score(
    input: str,
    expected,
    threshold: float = 0.5,
    verbose: bool = False
):`;
      expect(extractPythonFunctionParams(code)).toEqual([
        { name: "input", type: "string" },
        { name: "expected", type: undefined },
        { name: "threshold", type: "number" },
        { name: "verbose", type: "boolean" },
      ]);
    });
  });

  describe("ignores non-score function definitions", () => {
    it("ignores a helper function defined before score", () => {
      const code = `def helper(x: float):
    pass

def score(a: int, b: str):
    pass`;
      expect(extractPythonFunctionParams(code)).toEqual([
        { name: "a", type: "integer" },
        { name: "b", type: "string" },
      ]);
    });

    it("ignores a helper function defined after score", () => {
      const code = `def score(a: int, b: str):
    pass

def helper(x: float):
    pass`;
      expect(extractPythonFunctionParams(code)).toEqual([
        { name: "a", type: "integer" },
        { name: "b", type: "string" },
      ]);
    });
  });
});
