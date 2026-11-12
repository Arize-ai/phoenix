import { getProjectCodeDraftOperationError } from "@phoenix/pages/project/evaluators/useProjectCodeEvaluatorDraftRegistration";

describe("getProjectCodeDraftOperationError", () => {
  it("points a hand-written test payload at the bench", () => {
    expect(
      getProjectCodeDraftOperationError({
        operations: [
          {
            type: "set_test_payload",
            testPayload: { input: {}, output: {}, reference: {}, metadata: {} },
          },
        ],
        isLanguageEditable: true,
      })
    ).toContain("evaluators.project.bench.run");
  });

  it("refuses a language change on an edit form", () => {
    expect(
      getProjectCodeDraftOperationError({
        operations: [{ type: "set_language", language: "TYPESCRIPT" }],
        isLanguageEditable: false,
      })
    ).not.toBeNull();
  });

  it("allows source, sandbox, and mapping edits", () => {
    expect(
      getProjectCodeDraftOperationError({
        operations: [
          { type: "set_source_code", sourceCode: "def evaluate(): return 1" },
          { type: "set_language", language: "PYTHON" },
        ],
        isLanguageEditable: true,
      })
    ).toBeNull();
  });
});
