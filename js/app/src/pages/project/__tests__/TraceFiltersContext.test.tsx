import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TraceFiltersProvider, useTraceFilters } from "../TraceFiltersContext";

describe("TraceFiltersProvider URL seeding", () => {
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

  async function renderAt(path: string) {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <TraceFiltersProvider>
            <FilterConditionReader />
          </TraceFiltersProvider>
        </MemoryRouter>
      );
    });
  }

  it("seeds from the URL", async () => {
    await renderAt("/traces?traceFilterCondition=num_spans%20%3E%3D%205");

    expect(container.textContent).toBe("num_spans >= 5");
  });

  it("normalizes a whitespace-only URL condition to empty", async () => {
    await renderAt("/traces?traceFilterCondition=%20%20%20");

    expect(container.textContent).toBe("");
  });
});

function FilterConditionReader() {
  const { filterCondition } = useTraceFilters();
  return <div>{filterCondition}</div>;
}
