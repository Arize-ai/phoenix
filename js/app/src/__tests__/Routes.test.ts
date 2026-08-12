import type { ShouldRevalidateFunctionArgs } from "react-router";

import { revalidateOnProjectChange } from "@phoenix/Routes";

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

describe("revalidateOnProjectChange", () => {
  it("skips revalidation within the same project", () => {
    const args = makeArgs({
      currentPath: "/projects/project-1/spans/span-1",
      nextPath: "/projects/project-1/traces",
      currentProjectId: "project-1",
      nextProjectId: "project-1",
    });

    expect(revalidateOnProjectChange(args)).toBe(false);
  });

  it("revalidates when the project changes", () => {
    const args = makeArgs({
      currentPath: "/projects/project-1/traces",
      nextPath: "/projects/project-2/traces",
      currentProjectId: "project-1",
      nextProjectId: "project-2",
    });

    expect(revalidateOnProjectChange(args)).toBe(true);
  });

  it("defers same-URL revalidation to React Router", () => {
    const args = makeArgs({
      currentPath: "/projects/project-1/traces",
      nextPath: "/projects/project-1/traces",
      currentProjectId: "project-1",
      nextProjectId: "project-1",
      defaultShouldRevalidate: true,
    });

    expect(revalidateOnProjectChange(args)).toBe(true);
  });
});
