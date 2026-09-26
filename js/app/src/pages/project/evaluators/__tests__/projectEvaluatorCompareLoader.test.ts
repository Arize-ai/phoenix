import { describe, expect, it } from "vitest";

import { shouldRevalidateProjectEvaluatorCompare } from "../projectEvaluatorCompareLoader";

const base = "http://localhost/projects/p1/evaluators/compare";
const pair = "evaluatorId=a&evaluatorId=b";

function revalidate({
  current,
  next,
  currentProjectId = "p1",
  nextProjectId = "p1",
  defaultShouldRevalidate = true,
}: {
  current: string;
  next: string;
  currentProjectId?: string;
  nextProjectId?: string;
  defaultShouldRevalidate?: boolean;
}) {
  return shouldRevalidateProjectEvaluatorCompare({
    currentUrl: new URL(current),
    nextUrl: new URL(next),
    currentParams: { projectId: currentProjectId },
    nextParams: { projectId: nextProjectId },
    defaultShouldRevalidate,
  });
}

describe("shouldRevalidateProjectEvaluatorCompare", () => {
  it("skips the loader when only the matrix selection changes", () => {
    expect(
      revalidate({
        current: `${base}?${pair}`,
        next: `${base}?${pair}&compareSelection=%7B%7D`,
      })
    ).toBe(false);
  });

  it("skips the loader when a target drawer opens over the same pair", () => {
    expect(
      revalidate({
        current: `${base}?${pair}`,
        next: `${base}/trace-1?${pair}&selectedSpanNodeId=s1`,
      })
    ).toBe(false);
  });

  it("re-runs the loader when the compared pair changes", () => {
    expect(
      revalidate({
        current: `${base}?${pair}`,
        next: `${base}?evaluatorId=a&evaluatorId=c`,
      })
    ).toBe(true);
  });

  it("re-runs the loader when the pair is reordered", () => {
    expect(
      revalidate({
        current: `${base}?${pair}`,
        next: `${base}?evaluatorId=b&evaluatorId=a`,
      })
    ).toBe(true);
  });

  it("re-runs the loader when the project changes", () => {
    expect(
      revalidate({
        current: `${base}?${pair}`,
        next: `http://localhost/projects/p2/evaluators/compare?${pair}`,
        nextProjectId: "p2",
      })
    ).toBe(true);
  });

  it("defers to the router default for same-URL revalidation", () => {
    expect(
      revalidate({
        current: `${base}?${pair}`,
        next: `${base}?${pair}`,
        defaultShouldRevalidate: true,
      })
    ).toBe(true);
  });
});
