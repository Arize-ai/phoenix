import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { StatItem } from "../TableAside";

installTestMatchMedia();

describe("StatItem", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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

  it("renders an info tip beside the label when given help", () => {
    act(() => {
      root.render(
        <ThemeProvider>
          <StatItem label="Net per hour" help="Added minus completed.">
            <span>0</span>
          </StatItem>
        </ThemeProvider>
      );
    });

    expect(container.querySelector("h3")?.textContent).toBe("Net per hour");
    const tip = container.querySelector(
      'button[aria-label="More information"]'
    );
    expect(tip).not.toBeNull();
  });

  it("renders no info tip without help", () => {
    act(() => {
      root.render(
        <ThemeProvider>
          <StatItem label="Traces">
            <span>0</span>
          </StatItem>
        </ThemeProvider>
      );
    });

    expect(container.querySelector("button")).toBeNull();
  });
});
