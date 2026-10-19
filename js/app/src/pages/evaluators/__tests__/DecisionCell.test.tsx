import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { DecisionCell } from "../DecisionCell";

describe("DecisionCell", () => {
  it("renders nothing without a decision version", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <DecisionCell decisionVersion={null} />
        </MemoryRouter>
      )
    );
    expect(container.innerHTML).toBe("");
    act(() => root.unmount());
  });
});
