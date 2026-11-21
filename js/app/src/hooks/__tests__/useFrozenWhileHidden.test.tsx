import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DeferredVisibilityContext,
  useFrozenWhileHidden,
} from "../useFrozenWhileHidden";

let container: HTMLDivElement;
let root: Root;
let renderedValues: string[];

function Harness({ value }: { value: string }) {
  renderedValues.push(useFrozenWhileHidden(value));
  return null;
}

function render({ value, isVisible }: { value: string; isVisible: boolean }) {
  act(() => {
    root.render(
      <DeferredVisibilityContext.Provider value={isVisible}>
        <Harness value={value} />
      </DeferredVisibilityContext.Provider>
    );
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  renderedValues = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("useFrozenWhileHidden", () => {
  it("returns a new value in the render that receives it while visible", () => {
    render({ value: "first", isVisible: true });
    renderedValues = [];
    render({ value: "second", isVisible: true });
    expect(renderedValues).not.toContain("first");
    expect(renderedValues.at(-1)).toBe("second");
  });

  it("holds the last visible value while hidden and catches up when shown", () => {
    render({ value: "first", isVisible: true });
    render({ value: "second", isVisible: false });
    expect(renderedValues.at(-1)).toBe("first");
    renderedValues = [];
    render({ value: "second", isVisible: true });
    expect(renderedValues).not.toContain("first");
    expect(renderedValues.at(-1)).toBe("second");
  });
});
