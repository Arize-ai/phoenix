import type { ShouldRevalidateFunctionArgs } from "react-router";

import {
  revalidateOnDatasetChange,
  revalidateOnProjectChange,
} from "@phoenix/Routes";

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

describe("revalidateOnDatasetChange", () => {
  const compareUrl = "/datasets/dataset-1/compare?experimentId=a";

  function makeDatasetArgs({
    nextPath,
    nextDatasetId = "dataset-1",
    defaultShouldRevalidate = true,
  }: {
    nextPath: string;
    nextDatasetId?: string;
    defaultShouldRevalidate?: boolean;
  }): ShouldRevalidateFunctionArgs {
    return {
      currentUrl: new URL(compareUrl, "https://example.com"),
      currentParams: { datasetId: "dataset-1" },
      nextUrl: new URL(nextPath, "https://example.com"),
      nextParams: { datasetId: nextDatasetId },
      defaultShouldRevalidate,
    };
  }

  it("skips revalidation when only search params change", () => {
    expect(
      revalidateOnDatasetChange(
        makeDatasetArgs({ nextPath: `${compareUrl}&selectedExampleId=ex-1` })
      )
    ).toBe(false);
  });

  it("revalidates when the dataset changes", () => {
    expect(
      revalidateOnDatasetChange(
        makeDatasetArgs({
          nextPath: "/datasets/dataset-2/compare",
          nextDatasetId: "dataset-2",
        })
      )
    ).toBe(true);
  });

  it("defers to the router for a same-URL revalidation", () => {
    expect(
      revalidateOnDatasetChange(makeDatasetArgs({ nextPath: compareUrl }))
    ).toBe(true);
  });
});
