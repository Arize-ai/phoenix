import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useInitialSpanFilterCondition } from "../SpanFiltersContext";

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

function InitialConditionReader() {
  const condition = useInitialSpanFilterCondition("parent_id is None");
  return <div>{condition}</div>;
}
