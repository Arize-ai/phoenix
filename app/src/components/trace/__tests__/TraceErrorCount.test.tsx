import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { TraceErrorCount } from "../TraceErrorCount";

describe("TraceErrorCount", () => {
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

  function renderErrorCount(errorCount: number) {
    act(() => {
      root.render(
        <ThemeProvider>
          <TraceErrorCount errorCount={errorCount} />
        </ThemeProvider>
      );
    });
  }

  it("hides zero errors", () => {
    renderErrorCount(0);

    expect(container.childElementCount).toBe(0);
  });

  it.each([
    [1, "1 error span"],
    [3, "3 error spans"],
  ])("shows %i in a danger counter", (errorCount, errorLabel) => {
    renderErrorCount(errorCount);

    const wrapper = container.querySelector<HTMLElement>(
      `[aria-label="${errorLabel}"]`
    );
    const counter = wrapper?.querySelector<HTMLElement>(".counter");
    expect(wrapper?.title).toBe(errorLabel);
    expect(counter?.dataset.variant).toBe("danger");
    expect(counter?.textContent).toBe(String(errorCount));
  });
});
