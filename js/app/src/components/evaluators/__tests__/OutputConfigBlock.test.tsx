import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import { OutputConfigBlock } from "../OutputConfigBlock";

describe("OutputConfigBlock continuous threshold", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(threshold: number | null) {
    await act(async () => {
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "dark",
            themeMode: "dark",
            systemTheme: "dark",
            setThemeMode: vi.fn(),
          }}
        >
          <OutputConfigBlock
            typename="ContinuousAnnotationConfig"
            config={{
              name: "fixed-helpfulness",
              optimizationDirection: "MAXIMIZE",
              lowerBound: 0,
              upperBound: 10,
              threshold,
            }}
          />
        </ThemeContext.Provider>
      );
    });
  }

  it("shows a saved threshold", async () => {
    await render(7);
    expect(container.textContent).toContain("Threshold7");
  });

  it("names the midpoint when none is saved", async () => {
    await render(null);
    expect(container.textContent).toContain("ThresholdMidpoint");
  });
});
