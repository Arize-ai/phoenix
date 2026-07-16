import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { usePaginationFragment } from "react-relay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExampleExperimentRunsTable } from "../ExampleExperimentRunsTable";

vi.mock("react-relay", () => ({
  graphql: vi.fn(),
  usePaginationFragment: vi.fn(),
}));

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@phoenix/components/table/TimestampCell", () => ({
  TimestampCell: () => <span>timestamp</span>,
}));

const longError = `/tmp/${"nested/".repeat(30)}experiment-run-error`;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  vi.mocked(usePaginationFragment).mockReturnValue({
    data: {
      experimentRuns: {
        edges: [
          {
            run: {
              id: "run-1",
              startTime: "2026-07-16T00:00:00Z",
              endTime: "2026-07-16T00:00:01Z",
              error: longError,
              output: null,
              trace: {
                id: "trace-1",
                traceId: "trace-id-1",
                projectId: "project-1",
              },
              annotations: { edges: [] },
            },
          },
        ],
      },
    },
    hasNext: false,
    isLoadingNext: false,
    loadNext: vi.fn(),
  } as never);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

describe("ExampleExperimentRunsTable", () => {
  it("contains long errors without dropping later columns", () => {
    act(() => {
      root.render(<ExampleExperimentRunsTable example={{} as never} />);
    });

    const columnWidths = Array.from(
      container.querySelectorAll<HTMLTableColElement>("colgroup col")
    ).map((column) => column.style.width);
    expect(columnWidths).toEqual(["20%", "28%", "12%", "30%", "10%"]);
    expect(container.querySelector(`[title="${longError}"]`)).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="view trace"]')
    ).not.toBeNull();
  });
});
