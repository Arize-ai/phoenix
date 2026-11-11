import { describe, expect, it } from "vitest";

import { EVALUATOR_PREVIEW_MAX_SUBJECTS } from "@phoenix/components/evaluators/useEvaluatorPreview";
import { previewSubjectBatches } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTestBench";

const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ key: `row-${index}` }));

/**
 * Test all sends every loaded row, and "Show more" has no ceiling, so the
 * bench splits its rows into requests the server's subject cap accepts.
 */
describe("previewSubjectBatches", () => {
  it("sends up to the cap in one request", () => {
    const batches = previewSubjectBatches(rows(EVALUATOR_PREVIEW_MAX_SUBJECTS));
    expect(batches.map((batch) => batch.length)).toEqual([
      EVALUATOR_PREVIEW_MAX_SUBJECTS,
    ]);
  });

  it("splits more rows than the cap into requests of at most the cap", () => {
    const batches = previewSubjectBatches(
      rows(2 * EVALUATOR_PREVIEW_MAX_SUBJECTS + 1)
    );
    expect(batches.map((batch) => batch.length)).toEqual([
      EVALUATOR_PREVIEW_MAX_SUBJECTS,
      EVALUATOR_PREVIEW_MAX_SUBJECTS,
      1,
    ]);
    expect(batches.flat().map(({ key }) => key)).toEqual(
      rows(2 * EVALUATOR_PREVIEW_MAX_SUBJECTS + 1).map(({ key }) => key)
    );
  });

  it("sends a key listed twice once, so duplicates do not count toward the cap", () => {
    const listed = [...rows(EVALUATOR_PREVIEW_MAX_SUBJECTS), { key: "row-0" }];
    const batches = previewSubjectBatches(listed);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(EVALUATOR_PREVIEW_MAX_SUBJECTS);
  });

  it("sends nothing for no rows", () => {
    expect(previewSubjectBatches([])).toEqual([]);
  });
});
