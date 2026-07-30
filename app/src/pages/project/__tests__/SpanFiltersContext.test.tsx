import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The provider registers the agent's `set_spans_filter` action and reads the
// project id; neither is under test here.
vi.mock("@phoenix/contexts/AgentContext", () => ({
  useAgentStore: () => ({
    getState: () => ({
      registerClientAction: vi.fn(),
      unregisterClientAction: vi.fn(),
    }),
  }),
}));

vi.mock("@phoenix/contexts/TracingContext", () => ({
  useTracingContext: (selector: (state: { projectId: string }) => unknown) =>
    selector({ projectId: "UHJvamVjdDox" }),
}));

import {
  SpanFiltersProvider,
  useInitialSpanFilterCondition,
  useSpanFilters,
} from "../SpanFiltersContext";

describe("useInitialSpanFilterCondition", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("normalizes a whitespace-only URL condition to empty", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/spans?spanFilterCondition=%20%20%20"]}>
          <InitialConditionReader />
        </MemoryRouter>
      );
    });

    expect(container.textContent).toBe("");
  });
});

describe("SpanFiltersProvider URL seeding", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderAt(path: string, seedFromUrl?: boolean) {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <SpanFiltersProvider seedFromUrl={seedFromUrl}>
            <FilterConditionReader />
          </SpanFiltersProvider>
        </MemoryRouter>
      );
    });
  }

  it("seeds from the URL by default", async () => {
    await renderAt("/spans?spanFilterCondition=span_kind%20%3D%3D%20'LLM'");

    expect(container.textContent).toBe("span_kind == 'LLM'");
  });

  it("ignores the URL when the caller opts out", async () => {
    // A view whose first query cannot carry the filter must not display one, or
    // it renders unfiltered rows under a filter that appears to be applied.
    await renderAt(
      "/traces?spanFilterCondition=span_kind%20%3D%3D%20'LLM'",
      false
    );

    expect(container.textContent).toBe("");
  });
});

function InitialConditionReader() {
  const condition = useInitialSpanFilterCondition("parent_id is None");
  return <div>{condition}</div>;
}

function FilterConditionReader() {
  const { filterCondition } = useSpanFilters();
  return <div>{filterCondition}</div>;
}
