import type { ShouldRevalidateFunctionArgs } from "react-router";

import {
  revalidateOnPathChange,
  revalidateOutsideSameProject,
} from "../shouldRevalidate";

function makeArgs({
  currentPath,
  nextPath,
  currentProjectId,
  nextProjectId,
  defaultShouldRevalidate = true,
}: {
  currentPath: string;
  nextPath: string;
  currentProjectId?: string;
  nextProjectId?: string;
  defaultShouldRevalidate?: boolean;
}): ShouldRevalidateFunctionArgs {
  return {
    currentUrl: new URL(currentPath, "https://example.com"),
    currentParams: { projectId: currentProjectId },
    nextUrl: new URL(nextPath, "https://example.com"),
    nextParams: { projectId: nextProjectId },
    defaultShouldRevalidate,
  };
}

describe("revalidateOnPathChange", () => {
  it("skips revalidation for search param changes", () => {
    const args = makeArgs({
      currentPath: "/projects/project-1/traces?timeRangeKey=7d",
      nextPath: "/projects/project-1/traces?timeRangeKey=24h",
    });

    expect(revalidateOnPathChange(args)).toBe(false);
  });

  it("defers to React Router when the pathname changes", () => {
    const args = makeArgs({
      currentPath: "/projects/project-1/traces",
      nextPath: "/projects/project-1/spans",
    });

    expect(revalidateOnPathChange(args)).toBe(true);
  });
});

describe("revalidateOutsideSameProject", () => {
  it("skips revalidation when switching project tabs", () => {
    const args = makeArgs({
      currentPath: "/projects/project-1/traces",
      nextPath: "/projects/project-1/spans",
      currentProjectId: "project-1",
      nextProjectId: "project-1",
    });

    expect(revalidateOutsideSameProject(args)).toBe(false);
  });

  it("skips revalidation when closing a project detail drawer", () => {
    const args = makeArgs({
      currentPath: "/projects/project-1/traces/trace-1",
      nextPath: "/projects/project-1/traces",
      currentProjectId: "project-1",
      nextProjectId: "project-1",
    });

    expect(revalidateOutsideSameProject(args)).toBe(false);
  });

  it("revalidates when switching projects", () => {
    const args = makeArgs({
      currentPath: "/projects/project-1/traces",
      nextPath: "/projects/project-2/traces",
      currentProjectId: "project-1",
      nextProjectId: "project-2",
    });

    expect(revalidateOutsideSameProject(args)).toBe(true);
  });

  it("revalidates when leaving a project", () => {
    const args = makeArgs({
      currentPath: "/projects/project-1/traces",
      nextPath: "/datasets",
      currentProjectId: "project-1",
    });

    expect(revalidateOutsideSameProject(args)).toBe(true);
  });
});
