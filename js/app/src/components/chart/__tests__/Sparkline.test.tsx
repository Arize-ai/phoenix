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

  it("connects the line straight through empty bins", () => {
    render([0, 1, null, 1, 0]);
    expect(getPath()).toBe(
      "M 0.00 18.00 L 16.00 2.00 L 48.00 2.00 L 64.00 18.00"
    );
  });

  it("pins the populated span to the edges when the series starts or ends empty", () => {
    render([null, 0.5, null, null, 1, null]);
    expect(getPath()).toBe("M 0.00 18.00 L 64.00 2.00");
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
