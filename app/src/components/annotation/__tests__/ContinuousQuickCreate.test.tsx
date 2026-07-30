import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ContinuousQuickCreate,
  getContinuousQuickCreateValues,
  isContinuousQuickCreateConfig,
} from "@phoenix/components/annotation/ContinuousQuickCreate";
import type { AnnotationConfigContinuous } from "@phoenix/components/annotation/types";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

const config: AnnotationConfigContinuous = {
  annotationType: "CONTINUOUS",
  description: null,
  id: "config-score",
  lowerBound: 0,
  name: "score",
  optimizationDirection: "NONE",
  upperBound: 1,
};

describe("ContinuousQuickCreate", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("recognizes only explicit normalized ranges", () => {
    expect(isContinuousQuickCreateConfig({ config })).toBe(true);
    expect(
      isContinuousQuickCreateConfig({
        config: { ...config, lowerBound: -1, upperBound: 1 },
      })
    ).toBe(true);
    expect(
      isContinuousQuickCreateConfig({
        config: { ...config, upperBound: null },
      })
    ).toBe(false);
    expect(
      isContinuousQuickCreateConfig({
        config: { ...config, upperBound: 5 },
      })
    ).toBe(false);
  });

  it("builds ten intervals including both endpoints", () => {
    expect(
      getContinuousQuickCreateValues({ lowerBound: 0, upperBound: 1 })
    ).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
    expect(
      getContinuousQuickCreateValues({ lowerBound: -1, upperBound: 1 })
    ).toEqual([-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it("creates a selected score and opens the exact editor from Explain", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <ContinuousQuickCreate
            annotationName="score"
            config={config}
            onCreate={onCreate}
          />
        </ThemeProvider>
      );
    });
    const user = userEvent.setup();

    const scoreValues = Array.from(
      container.querySelectorAll<HTMLElement>('[data-appearance="compact"]')
    );
    expect(scoreValues.map((score) => score.textContent)).toEqual([
      "0.0",
      "0.1",
      "0.2",
      "0.3",
      "0.4",
      "0.5",
      "0.6",
      "0.7",
      "0.8",
      "0.9",
      "1.0",
    ]);
    expect(
      scoreValues.every(
        (score) =>
          score.classList.contains("font-mono") && score.dataset.size === "S"
      )
    ).toBe(true);
    const firstScoreButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Add 0.0"]'
    );
    expect(firstScoreButton?.classList.contains("button--reset")).toBe(true);
    expect(firstScoreButton?.dataset.variant).toBeUndefined();
    expect(container.querySelector("[data-direction]")).toBeNull();
    if (firstScoreButton == null) {
      throw new Error("Expected the first continuous score button");
    }
    const firstScore = scoreValues[0];
    if (firstScore == null) {
      throw new Error("Expected the first continuous score value");
    }
    await act(async () => user.hover(firstScoreButton));
    expect(getComputedStyle(firstScore).color).toBe(
      "var(--global-static-color-white-900)"
    );
    await act(async () => user.unhover(firstScoreButton));

    await act(async () => {
      await user.click(
        container.querySelector<HTMLButtonElement>('[aria-label="Add 0.5"]')!
      );
    });
    expect(onCreate).toHaveBeenLastCalledWith({
      shouldExplain: false,
      value: expect.objectContaining({ score: 0.5 }),
    });

    await act(async () => {
      await user.click(
        Array.from(
          container.querySelectorAll<HTMLButtonElement>("button")
        ).find((button) => button.textContent === "Explain")!
      );
    });
    expect(onCreate).toHaveBeenLastCalledWith({
      shouldExplain: true,
      value: expect.objectContaining({ score: 0 }),
    });
  });

  it("applies the configured semantic direction", () => {
    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <ContinuousQuickCreate
            annotationName="score"
            config={{ ...config, optimizationDirection: "MAXIMIZE" }}
            onCreate={vi.fn().mockResolvedValue(undefined)}
          />
        </ThemeProvider>
      );
    });

    expect(
      container
        .querySelector('[aria-label="Add 0.0"]')
        ?.querySelector("[data-direction]")
        ?.getAttribute("data-direction")
    ).toBe("negative");
    expect(
      container
        .querySelector('[aria-label="Add 1.0"]')
        ?.querySelector("[data-direction]")
        ?.getAttribute("data-direction")
    ).toBe("positive");
  });
});
