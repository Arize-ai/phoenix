import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ExperimentStatus } from "../ExperimentStatus";

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

describe("ExperimentStatus", () => {
  it("shows a status the client does not recognize by its raw name", () => {
    act(() => {
      root.render(<ExperimentStatus status="PAUSED" />);
    });
    expect(
      container
        .querySelector(".status-indicator")
        ?.getAttribute("data-category")
    ).toBe("unset");
    expect(container.textContent).toContain("PAUSED");
  });
});
