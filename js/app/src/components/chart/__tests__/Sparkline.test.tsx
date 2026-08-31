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

  it("draws one path through contiguous values, spanning the full width", () => {
    render([0, 0.5, 1]);
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(1);
    const d = paths[0].getAttribute("d")!;
    // Three points: min at the bottom, max at the top, full width covered
    expect(d).toBe("M 0.00 18.00 L 32.00 10.00 L 64.00 2.00");
  });

  it("breaks the line at null bins instead of interpolating", () => {
    render([0, 1, null, 1, 0]);
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(2);
  });

  it("marks an isolated value with a dot", () => {
    render([null, 0.5, null]);
    expect(container.querySelectorAll("path")).toHaveLength(0);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
  });

  it("draws a flat series as a midline", () => {
    render([0.7, 0.7, 0.7]);
    const d = container.querySelector("path")!.getAttribute("d")!;
    expect(d).toBe("M 0.00 10.00 L 32.00 10.00 L 64.00 10.00");
  });

  it("renders nothing when every value is null", () => {
    render([null, null]);
    expect(container.querySelector("svg")).toBeNull();
  });
});
