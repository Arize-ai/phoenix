import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ToolFilledSVG } from "../SpanKindIcon";

describe("ToolFilledSVG", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("uses a unique mask for every rendered tool icon", () => {
    act(() => {
      root.render(
        <>
          <ToolFilledSVG />
          <ToolFilledSVG />
        </>
      );
    });

    const icons = Array.from(container.querySelectorAll("svg"));
    const maskIds = icons.map((icon) => icon.querySelector("mask")?.id);
    const maskReferences = icons.map((icon) =>
      icon.querySelector("path[mask]")?.getAttribute("mask")
    );

    expect(new Set(maskIds).size).toBe(icons.length);
    expect(maskReferences).toEqual(maskIds.map((id) => `url(#${id})`));
  });
});
