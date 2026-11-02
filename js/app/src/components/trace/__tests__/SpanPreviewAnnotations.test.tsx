import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";
import type { AnnotationSummary } from "@phoenix/components/annotation/types";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import {
  SpanPreviewAnnotations,
  type SpanPreviewAnnotationsProps,
} from "../SpanPreviewAnnotations";

/** Unfavorable below 0.5 */
const MAXIMIZE_CONFIG: AnnotationOptimizationConfig = {
  annotationType: "CONTINUOUS",
  optimizationDirection: "MAXIMIZE",
  lowerBound: 0,
  upperBound: 1,
};

/** One unfavorable eval of three, all under a config */
const SUMMARIES: AnnotationSummary[] = [
  { name: "alpha", count: 1, meanScore: 1, labelFractions: [] },
  { name: "beta", count: 1, meanScore: 0, labelFractions: [] },
  { name: "gamma", count: 1, meanScore: 1, labelFractions: [] },
];
const CONFIGS = new Map(SUMMARIES.map(({ name }) => [name, MAXIMIZE_CONFIG]));

describe("SpanPreviewAnnotations", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
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

  function renderAnnotations(props: Partial<SpanPreviewAnnotationsProps>) {
    act(() => {
      root.render(
        <ThemeProvider themeMode="dark">
          <SpanPreviewAnnotations
            summaries={SUMMARIES}
            annotationConfigsByName={CONFIGS}
            {...props}
          />
        </ThemeProvider>
      );
    });
  }

  it("counts unfavorable evals by the heading unless told not to", () => {
    renderAnnotations({});
    expect(container.textContent).toContain("1 of 3 unfavorable");

    renderAnnotations({ showUnfavorableCount: false });
    expect(container.textContent).not.toMatch(/of \d+ unfavorable/);
  });

  it("counts every eval, including ones past the row cap", () => {
    renderAnnotations({ maxRows: 1 });
    expect(container.textContent).toContain("1 of 3 unfavorable");
    expect(container.textContent).toContain("+2 more");
  });

  it("evens out row heights only when a value is tinted", () => {
    const list = () =>
      container.querySelector(".span-preview-annotations__list");
    renderAnnotations({});
    expect(list()?.classList).toContain(
      "span-preview-annotations__list--tinted"
    );

    renderAnnotations({ annotationConfigsByName: new Map() });
    expect(list()?.classList).not.toContain(
      "span-preview-annotations__list--tinted"
    );
  });
});
