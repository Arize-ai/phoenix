import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { Icons } from "@phoenix/components/core/icon";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { SpanKindIcon, ToolFilledSVG } from "../SpanKindIcon";

describe("SpanKindIcon", () => {
  installTestMatchMedia();

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

  it.each([
    ["session", <Icons.MessagesSquare key="session" />],
    ["trace", <Icons.Trace key="trace" />],
  ])("uses the canonical %s icon", (spanKind, expectedIcon) => {
    act(() => {
      root.render(
        <ThemeProvider>
          <div data-testid="actual-icon">
            <SpanKindIcon spanKind={spanKind} isFramed={false} />
          </div>
          <div data-testid="expected-icon">{expectedIcon}</div>
        </ThemeProvider>
      );
    });

    const actualIcon = container.querySelector(
      '[data-testid="actual-icon"] svg'
    );
    const expectedCanonicalIcon = container.querySelector(
      '[data-testid="expected-icon"] svg'
    );
    expect(actualIcon?.outerHTML).toBe(expectedCanonicalIcon?.outerHTML);
  });
});
