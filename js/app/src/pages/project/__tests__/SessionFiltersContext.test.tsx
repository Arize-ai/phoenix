import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  SessionFiltersProvider,
  useSessionFilters,
} from "../SessionFiltersContext";

describe("SessionFiltersProvider URL seeding", () => {
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
          <SessionFiltersProvider>
            <FilterConditionReader />
          </SessionFiltersProvider>
        </MemoryRouter>
      );
    });
  }

  it("seeds from the URL", async () => {
    await renderAt("/sessions?sessionFilterCondition=num_traces%20%3E%3D%205");

    expect(container.textContent).toBe("num_traces >= 5");
  });

  it("normalizes a whitespace-only URL condition to empty", async () => {
    await renderAt("/sessions?sessionFilterCondition=%20%20%20");

    expect(container.textContent).toBe("");
  });
});

function FilterConditionReader() {
  const { filterCondition } = useSessionFilters();
  return <div>{filterCondition}</div>;
}
