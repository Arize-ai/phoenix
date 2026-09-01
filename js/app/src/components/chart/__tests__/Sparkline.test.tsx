import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Sparkline } from "@phoenix/components/chart";

describe("Sparkline", () => {
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

  const render = (values: (number | null)[]) => {
    act(() => {
      root.render(<Sparkline values={values} color="currentColor" />);
    });
  };

  const getPath = () => container.querySelector("path")?.getAttribute("d");

  it("draws one line through the values, spanning the full width", () => {
    render([0, 0.5, 1]);
    // Three points: min at the bottom, max at the top, full width covered
    expect(getPath()).toBe("M 0.00 18.00 L 32.00 10.00 L 64.00 2.00");
  });

  it("breaks the line at empty bins, keeping every bin's x position", () => {
    render([0, 1, null, 1, 0]);
    const paths = [...container.querySelectorAll("path")].map((path) =>
      path.getAttribute("d")
    );
    // The empty middle bin still occupies x=32, so the runs around it keep
    // their positions on the shared axis instead of stretching to meet.
    expect(paths).toEqual([
      "M 0.00 18.00 L 16.00 2.00",
      "M 48.00 2.00 L 64.00 18.00",
    ]);
  });

  it("draws a gap-isolated value as a dot beside the line", () => {
    render([0.2, 0.4, null, 0.9]);
    const paths = [...container.querySelectorAll("path")].map((path) =>
      path.getAttribute("d")
    );
    expect(paths).toEqual([
      "M 0.00 18.00 L 21.33 13.43",
      "M 64.00 2.00 l 0.01 0",
    ]);
  });

  it("keeps values in their bins when the series starts or ends empty", () => {
    render([null, 0.5, null, null, 1, null]);
    const paths = [...container.querySelectorAll("path")].map((path) =>
      path.getAttribute("d")
    );
    // Two values separated by gaps: two dots at their own bin positions,
    // not a line pinned to the edges.
    expect(paths).toEqual(["M 12.80 18.00 l 0.01 0", "M 51.20 2.00 l 0.01 0"]);
  });

  it("draws a flat series as a midline", () => {
    render([0.7, 0.7, 0.7]);
    expect(getPath()).toBe("M 0.00 10.00 L 32.00 10.00 L 64.00 10.00");
  });

  it("renders nothing for a single value, which has no trend to show", () => {
    render([null, 0.5, null]);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders nothing when every value is null", () => {
    render([null, null]);
    expect(container.querySelector("svg")).toBeNull();
  });
});
